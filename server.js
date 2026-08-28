const express = require("express");

const app = express();

app.use(express.json());

const SHOPIFY_SHOP = process.env.SHOPIFY_SHOP;
const SHOPIFY_CLIENT_ID = process.env.SHOPIFY_CLIENT_ID;
const SHOPIFY_CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET;


// ===============================
// GET SHOPIFY ACCESS TOKEN
// ===============================

async function getShopifyToken() {

    const response = await fetch(
        `https://${SHOPIFY_SHOP}.myshopify.com/admin/oauth/access_token`,
        {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                client_id: SHOPIFY_CLIENT_ID,
                client_secret: SHOPIFY_CLIENT_SECRET,
                grant_type: "client_credentials"
            })
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.error_description ||
            data.error ||
            "Could not get Shopify access token"
        );
    }

    return data.access_token;
}


// ===============================
// HOME
// ===============================

app.get("/", (req, res) => {
    res.send("TopUpMandu Custom Checkout Backend is running!");
});


// ===============================
// TEST SHOPIFY CONNECTION
// ===============================

app.get("/test-shopify", async (req, res) => {

    try {

        await getShopifyToken();

        res.json({
            success: true,
            message: "Successfully connected to Shopify!"
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            error: error.message
        });

    }

});


// ===============================
// CREATE SHOPIFY ORDER
// ===============================

app.post("/create-order", async (req, res) => {

    try {

        const {
            customer,
            variantId,
            quantity,
            packageName,
            playerId,
            region,
            paymentMethod
        } = req.body;


        // Basic validation

        if (!variantId) {
            return res.status(400).json({
                success: false,
                error: "Variant ID is required."
            });
        }

        if (!quantity || quantity < 1) {
            return res.status(400).json({
                success: false,
                error: "Quantity must be at least 1."
            });
        }


        // Get Shopify token

        const accessToken = await getShopifyToken();


        // Convert numeric variant ID to Shopify GID

        const variantGid =
            String(variantId).startsWith("gid://")
                ? variantId
                : `gid://shopify/ProductVariant/${variantId}`;


        // Create order mutation

        const mutation = `
            mutation CreateOrder(
                $order: OrderCreateOrderInput!
            ) {

                orderCreate(order: $order) {

                    userErrors {
                        field
                        message
                    }

                    order {
                        id
                        name
                        displayFinancialStatus

                        customer {
                            email
                            firstName
                            lastName
                        }

                        lineItems(first: 10) {
                            nodes {
                                title
                                quantity

                                variant {
                                    id
                                }
                            }
                        }
                    }
                }
            }
        `;


        // Order information

        const order = {

            lineItems: [

                {
                    variantId: variantGid,

                    quantity: Number(quantity),

                    properties: [

                        {
                            name: "Package",
                            value: packageName || "Not provided"
                        },

                        {
                            name: "Player ID",
                            value: playerId || "Not provided"
                        },

                        {
                            name: "Region",
                            value: region || "Not provided"
                        },

                        {
                            name: "Payment Method",
                            value: paymentMethod || "Not provided"
                        }

                    ]
                }

            ],

            email: customer?.email || undefined,

            phone: customer?.phone || undefined,

            note:
                "Order created through TopUpMandu Custom Checkout",

            tags: [
                "TopUpMandu",
                "Custom Checkout"
            ]

        };


        // Remove undefined values

        if (!order.email) {
            delete order.email;
        }

        if (!order.phone) {
            delete order.phone;
        }


        // Send request to Shopify

        const response = await fetch(
            `https://${SHOPIFY_SHOP}.myshopify.com/admin/api/2026-07/graphql.json`,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                    "X-Shopify-Access-Token": accessToken
                },

                body: JSON.stringify({
                    query: mutation,
                    variables: {
                        order: order
                    }
                })
            }
        );


        const result = await response.json();


        // GraphQL error

        if (result.errors) {

            console.error(result.errors);

            return res.status(500).json({
                success: false,
                error: result.errors
            });

        }


        const orderResult =
            result.data?.orderCreate;


        // Shopify user error

        if (
            !orderResult ||
            orderResult.userErrors?.length
        ) {

            return res.status(400).json({
                success: false,
                errors: orderResult?.userErrors || [
                    {
                        message: "Shopify order creation failed."
                    }
                ]
            });

        }


        // Success

        res.json({

            success: true,

            message: "Order created successfully!",

            order: orderResult.order

        });


    } catch (error) {

        console.error(error);

        res.status(500).json({

            success: false,

            error: error.message

        });

    }

});


// ===============================
// START SERVER
// ===============================

const PORT =
    process.env.PORT || 3000;


app.listen(PORT, () => {

    console.log(
        `TopUpMandu backend running on port ${PORT}`
    );

});