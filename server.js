const express = require("express");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;

const app = express();
// ========================================
// CLOUDINARY
// ========================================

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});


// ========================================
// PAYMENT SCREENSHOT UPLOAD
// ========================================

const upload = multer({
    storage: multer.memoryStorage(),

    limits: {
        fileSize: 5 * 1024 * 1024
    },

    fileFilter: (req, file, cb) => {

        if (
            file.mimetype === "image/jpeg" ||
            file.mimetype === "image/png" ||
            file.mimetype === "image/webp"
        ) {
            cb(null, true);
        } else {
            cb(
                new Error(
                    "Only JPG, PNG and WEBP images are allowed."
                )
            );
        }

    }
});

app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname));


// ========================================
// ENVIRONMENT VARIABLES
// ========================================

const SHOPIFY_SHOP =
    process.env.SHOPIFY_SHOP;

const SHOPIFY_CLIENT_ID =
    process.env.SHOPIFY_CLIENT_ID;

const SHOPIFY_CLIENT_SECRET =
    process.env.SHOPIFY_CLIENT_SECRET;


// ========================================
// CLOUDINARY
// ========================================

cloudinary.config({

    cloud_name:
        process.env.CLOUDINARY_CLOUD_NAME,

    api_key:
        process.env.CLOUDINARY_API_KEY,

    api_secret:
        process.env.CLOUDINARY_API_SECRET

});




// ========================================
// TEMPORARY CART STORAGE
// ========================================

const carts = new Map();


// ========================================
// HOME
// ========================================

app.get("/", (req, res) => {

    res.send(
        "TopUpMandu Custom Checkout Backend is running!"
    );

});


// ========================================
// CHECKOUT PAGE
// ========================================

app.get("/checkout", (req, res) => {

    res.sendFile(
        path.join(
            __dirname,
            "checkout.html"
        )
    );

});


// ========================================
// SHOPIFY TOKEN
// ========================================

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


    const response =
        await fetch(

            `https://${SHOPIFY_SHOP}.myshopify.com/admin/oauth/access_token`,

            {

                method:
                    "POST",

                headers: {

                    "Content-Type":
                        "application/json"

                },

                body:
                    JSON.stringify({

                        client_id:
                            SHOPIFY_CLIENT_ID,

                        client_secret:
                            SHOPIFY_CLIENT_SECRET,

                        grant_type:
                            "client_credentials"

                    })

            }

        );


    const data =
        await response.json();


    if (!response.ok) {

        throw new Error(

            data.error_description ||
            data.error ||
            "Could not get Shopify access token"

        );

    }


    return data.access_token;

}


// ========================================
// TEST SHOPIFY
// ========================================

app.get(
    "/test-shopify",
    async (req, res) => {

        try {

            await getShopifyToken();

            res.json({

                success:
                    true,

                message:
                    "Successfully connected to Shopify!"

            });

        } catch (error) {

            console.error(error);

            res.status(500).json({

                success:
                    false,

                error:
                    error.message

            });

        }

    }
);


// ========================================
// SAVE CART
// ========================================

app.post(
    "/cart",
    (req, res) => {

        try {

            const cart =
                req.body;


            if (
                !cart ||
                !Array.isArray(cart.items)
            ) {

                return res.status(400).json({

                    success:
                        false,

                    error:
                        "Invalid cart data."

                });

            }


            if (
                cart.items.length === 0
            ) {

                return res.status(400).json({

                    success:
                        false,

                    error:
                        "Cart is empty."

                });

            }


            const cartId =
                crypto.randomUUID();


            carts.set(

                cartId,

                {

                    cart:
                        cart,

                    createdAt:
                        Date.now()

                }

            );


            for (
                const [
                    id,
                    stored
                ]
                of carts.entries()
            ) {

                if (
                    Date.now() -
                    stored.createdAt >
                    30 * 60 * 1000
                ) {

                    carts.delete(id);

                }

            }


            res.json({

                success:
                    true,

                cartId:
                    cartId

            });


        } catch (error) {

            console.error(error);

            res.status(500).json({

                success:
                    false,

                error:
                    error.message

            });

        }

    }
);


// ========================================
// GET CART
// ========================================

app.get(
    "/cart/:cartId",
    (req, res) => {

        try {

            const stored =
                carts.get(
                    req.params.cartId
                );


            if (!stored) {

                return res.status(404).json({

                    success:
                        false,

                    error:
                        "Cart not found or expired."

                });

            }


            if (
                Date.now() -
                stored.createdAt >
                30 * 60 * 1000
            ) {

                carts.delete(
                    req.params.cartId
                );


                return res.status(404).json({

                    success:
                        false,

                    error:
                        "Cart has expired."

                });

            }


            res.json({

                success:
                    true,

                cart:
                    stored.cart

            });


        } catch (error) {

            console.error(error);

            res.status(500).json({

                success:
                    false,

                error:
                    error.message

            });

        }

    }
);
// ========================================
// UPLOAD PAYMENT SCREENSHOT
// ========================================

app.post(
    "/upload-payment-screenshot",
    upload.single("paymentScreenshot"),
    async (req, res) => {

        try {

            if (!req.file) {

                return res.status(400).json({
                    success: false,
                    error: "Payment screenshot is required."
                });

            }

            const uploadResult =
                await new Promise((resolve, reject) => {

                    const stream =
                        cloudinary.uploader.upload_stream(
                            {
                                folder:
                                    "topupmandu/payment-screenshots",

                                resource_type:
                                    "image"
                            },

                            (error, result) => {

                                if (error) {
                                    reject(error);
                                } else {
                                    resolve(result);
                                }

                            }
                        );

                    stream.end(
                        req.file.buffer
                    );

                });


            res.json({

                success: true,

                screenshotUrl:
                    uploadResult.secure_url

            });


        } catch (error) {

            console.error(
                "Screenshot upload error:",
                error
            );

            res.status(500).json({

                success: false,

                error:
                    error.message

            });

        }

    }
);

// ========================================
// CREATE SHOPIFY ORDER
// ========================================

app.post(
    "/create-order",
    async (req, res) => {

        try {

            const {
                customer,
                items,
                playerId,
                region,
                paymentMethod,
                paymentScreenshot
            } = req.body;


            /*
             * Parse customer and items
             * because FormData sends strings.
             */

            let parsedCustomer =
                customer;

            let parsedItems =
                items;


            try {

                if (
                    typeof customer ===
                    "string"
                ) {

                    parsedCustomer =
                        JSON.parse(customer);

                }


                if (
                    typeof items ===
                    "string"
                ) {

                    parsedItems =
                        JSON.parse(items);

                }

            } catch (error) {

                return res.status(400).json({

                    success:
                        false,

                    error:
                        "Invalid customer or cart data."

                });

            }


            if (
                !parsedItems ||
                !Array.isArray(parsedItems) ||
                parsedItems.length === 0
            ) {

                return res.status(400).json({

                    success:
                        false,

                    error:
                        "Cart items are required."

                });

            }


            // ========================================
            // UPLOAD PAYMENT SCREENSHOT
            // ========================================

            let screenshotUrl =
                "";


            if (req.file) {

                screenshotUrl =
                    await new Promise(
                        (resolve, reject) => {

                            const stream =
                                cloudinary.uploader.upload_stream(

                                    {

                                        folder:
                                            "topupmandu/payment-screenshots",

                                        resource_type:
                                            "image"

                                    },

                                    (
                                        error,
                                        result
                                    ) => {

                                        if (error) {

                                            reject(error);

                                        } else {

                                            resolve(
                                                result.secure_url
                                            );

                                        }

                                    }

                                );


                            stream.end(
                                req.file.buffer
                            );

                        }
                    );

            }


            // ========================================
            // SHOPIFY TOKEN
            // ========================================

            const accessToken =
                await getShopifyToken();


            // ========================================
            // SHOPIFY LINE ITEMS
            // ========================================

            const lineItems =
                parsedItems.map(
                    item => {

                        const variantId =
                            item.variant_id ||
                            item.variantId;


                        if (!variantId) {

                            throw new Error(
                                "Cart item is missing variant_id."
                            );

                        }


                        const variantGid =
                            String(
                                variantId
                            ).startsWith(
                                "gid://"
                            )

                                ? variantId

                                : `gid://shopify/ProductVariant/${variantId}`;


                        return {

                            variantId:
                                variantGid,

                            quantity:
                                Number(
                                    item.quantity
                                ) || 1,

                            properties: [

                                {

                                    name:
                                        "Player ID",

                                    value:
                                        playerId ||
                                        "Not provided"

                                },

                                {

                                    name:
                                        "Region",

                                    value:
                                        region ||
                                        "Not provided"

                                },

                                {

                                    name:
                                        "Payment Method",

                                    value:
                                        paymentMethod ||
                                        "Not provided"

                                }

                            ]

                        };

                    }
                );


            // ========================================
            // SHOPIFY ORDER
            // ========================================

            const mutation = `

                mutation CreateOrder(
                    $order: OrderCreateOrderInput!
                ) {

                    orderCreate(
                        order: $order
                    ) {

                        userErrors {

                            field

                            message

                        }

                        order {

                            id

                            name

                            displayFinancialStatus

                        }

                    }

                }

            `;


            const order = {

                lineItems:
                    lineItems,

                note:
                    "Order created through TopUpMandu Custom Checkout",

                tags: [
                    "TopUpMandu",
                    "Custom Checkout"
                ]

            };


            // ========================================
            // PAYMENT SCREENSHOT
            // ========================================

            if (paymentScreenshot) {

                order.note +=
                    "\nPayment Screenshot: " +
                    paymentScreenshot;

            }


            // ========================================
            // CUSTOMER INFORMATION
            // ========================================

            if (
                parsedCustomer?.email
            ) {

                order.email =
                    parsedCustomer.email;

            }


            if (
                parsedCustomer?.phone
            ) {

                order.phone =
                    parsedCustomer.phone;

            }


            // ========================================
            // ORDER CUSTOM ATTRIBUTES
            // ========================================

            const attributes = [];


            if (screenshotUrl) {

                attributes.push({

                    key:
                        "Payment Screenshot",

                    value:
                        screenshotUrl

                });

            }


            attributes.push({

                key:
                    "Payment Method",

                value:
                    paymentMethod ||
                    "Not provided"

            });


            if (playerId) {

                attributes.push({

                    key:
                        "Player ID",

                    value:
                        playerId

                });

            }


            if (region) {

                attributes.push({

                    key:
                        "Region",

                    value:
                        region

                });

            }


            order.customAttributes =
                attributes;


            // ========================================
            // SEND TO SHOPIFY
            // ========================================

            const response =
                await fetch(

                    `https://${SHOPIFY_SHOP}.myshopify.com/admin/api/2026-07/graphql.json`,

                    {

                        method:
                            "POST",

                        headers: {

                            "Content-Type":
                                "application/json",

                            "X-Shopify-Access-Token":
                                accessToken

                        },

                        body:
                            JSON.stringify({

                                query:
                                    mutation,

                                variables: {

                                    order:
                                        order

                                }

                            })

                    }

                );


            const result =
                await response.json();


            console.log(
                "Shopify response:",
                JSON.stringify(
                    result,
                    null,
                    2
                )
            );


            if (result.errors) {

                return res.status(500).json({

                    success:
                        false,

                    error:
                        result.errors

                });

            }


            const orderResult =
                result.data?.orderCreate;


            if (
                !orderResult ||
                orderResult.userErrors?.length
            ) {

                return res.status(400).json({

                    success:
                        false,

                    errors:
                        orderResult?.userErrors ||
                        [

                            {

                                message:
                                    "Shopify order creation failed."

                            }

                        ]

                });

            }


            // ========================================
            // SUCCESS
            // ========================================

            res.json({

                success:
                    true,

                message:
                    "Order created successfully!",

                screenshotUrl:
                    screenshotUrl || null,

                order:
                    orderResult.order

            });


        } catch (error) {

            console.error(
                "CREATE ORDER ERROR:",
                error
            );


            res.status(500).json({

                success:
                    false,

                error:
                    error.message

            });

        }

    }
);


// ========================================
// MULTER ERROR HANDLER
// ========================================

app.use(
    (error, req, res, next) => {

        if (
            error instanceof
            multer.MulterError
        ) {

            return res.status(400).json({

                success:
                    false,

                error:
                    "Screenshot upload failed: " +
                    error.message

            });

        }


        if (
            error &&
            error.message ===
            "Only image files are allowed."
        ) {

            return res.status(400).json({

                success:
                    false,

                error:
                    error.message

            });

        }


        next(error);

    }
);


// ========================================
// START SERVER
// ========================================

const PORT =
    process.env.PORT || 3000;


app.listen(
    PORT,
    () => {

        console.log(
            `TopUpMandu backend running on port ${PORT}`
        );

    }
);