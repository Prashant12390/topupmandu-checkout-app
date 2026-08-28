const express = require("express");
const path = require("path");

const app = express();

app.use(express.json({ limit: "1mb" }));

// Serve checkout.html and other files
app.use(express.static(__dirname));

const SHOPIFY_SHOP = process.env.SHOPIFY_SHOP;
const SHOPIFY_CLIENT_ID = process.env.SHOPIFY_CLIENT_ID;
const SHOPIFY_CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET);


// ===============================
// HOME
// ===============================

app.get("/", (req, res) => {
    res.send("TopUpMandu Custom Checkout Backend is running!");
});


// ===============================
// CHECKOUT PAGE
// ===============================

app.get("/checkout", (req, res) => {
    res.sendFile(path.join(__dirname, "checkout.html"));
});


// ===============================
// GET SHOPIFY ACCESS TOKEN
// ===============================

async function getShopifyToken() {

    if (
        !SHOPIFY_SHOP ||
        !SHOPIFY_CLIENT_ID ||
        !SHOPIFY_CLIENT_SECRET
    ) {
        throw new Error(
            "Shopify environment variables are missing."
        );
    }

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
// RECEIVE CART
// ===============================

app.post("/cart", (req, res) => {

    try {

        const cart = req.body;

        if (
            !cart ||
            !Array.isArray(cart.items)
        ) {

            return res.status(400).json({
                success: false,
                error: "Invalid cart data."
            });

        }

        res.json({
            success: true,
            cart: cart
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
            items,
            playerId,
            region,
            paymentMethod
        } = req.body;


        if (
            !items ||
            !Array.isArray(items) ||
            items.length === 0
        ) {

            return res.status(400).json({
                success: false,
                error: "Cart items are required."
            });

        }


        const accessToken =
            await getShopifyToken();


        /*
         * Convert Shopify cart items
         * into Shopify order line items.
         */

        const lineItems =
            items.map(item => {

                const variantId =
                    item.variant_id ||
                    item.variantId;

                if (!variantId) {
                    throw new Error(
                        "A cart item is missing variant_id."
                    );
                }

                const variantGid =
                    String(variantId).startsWith("gid://")
                        ? variantId
                        : `gid://shopify/ProductVariant/${variantId}`;


                return {

                    variantId: variantGid,

                    quantity:
                        Number(item.quantity) || 1,

                    properties: [

                        {
                            name: "Player ID",
                            value:
                                playerId ||
                                "Not provided"
                        },

                        {
                            name: "Region",
                            value:
                                region ||
                                "Not provided"
                        },

                        {
                            name: "Payment Method",
                            value:
                                paymentMethod ||
                                "Not provided"
                        }

                    ]

                };

            });


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

                        lineItems(first: 20) {

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


        const order = {

            lineItems: lineItems,

            note:
                "Order created through TopUpMandu Custom Checkout",

            tags: [
                "TopUpMandu",
                "Custom Checkout"
            ]

        };


        if (customer?.email) {
            order.email =
                customer.email;
        }


        if (customer?.phone) {
            order.phone =
                customer.phone;
        }


        const response = await fetch(

            `https://${SHOPIFY_SHOP}.myshopify.com/admin/api/2026-07/graphql.json`,

            {

                method: "POST",

                headers: {

                    "Content-Type":
                        "application/json",

                    "X-Shopify-Access-Token":
                        accessToken

                },

                body: JSON.stringify({

                    query: mutation,

                    variables: {
                        order: order
                    }

                })

            }

        );


        const result =
            await response.json();


        if (result.errors) {

            console.error(result.errors);

            return res.status(500).json({

                success: false,

                error: result.errors

            });

        }


        const orderResult =
            result.data?.orderCreate;


        if (
            !orderResult ||
            orderResult.userErrors?.length
        ) {

            return res.status(400).json({

                success: false,

                errors:
                    orderResult?.userErrors || [

                        {
                            message:
                                "Shopify order creation failed."
                        }

                    ]

            });

        }


        res.json({

            success: true,

            message:
                "Order created successfully!",

            order:
                orderResult.order

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