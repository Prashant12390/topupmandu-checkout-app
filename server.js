const express = require("express");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;

const app = express();

/* =========================================================
   CLOUDINARY
========================================================= */

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});


/* =========================================================
   MULTER - PAYMENT SCREENSHOT
========================================================= */

const upload = multer({

    storage: multer.memoryStorage(),

    limits: {
        fileSize: 5 * 1024 * 1024
    },

    fileFilter: (req, file, cb) => {

        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/webp"
        ];

        if (allowedTypes.includes(file.mimetype)) {

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


/* =========================================================
   BODY PARSERS
========================================================= */

app.use(express.json({
    limit: "2mb"
}));

app.use(express.urlencoded({
    extended: true,
    limit: "2mb"
}));

app.use(express.static(__dirname));


/* =========================================================
   SHOPIFY ENVIRONMENT VARIABLES
========================================================= */

const SHOPIFY_SHOP =
    process.env.SHOPIFY_SHOP;

const SHOPIFY_CLIENT_ID =
    process.env.SHOPIFY_CLIENT_ID;

const SHOPIFY_CLIENT_SECRET =
    process.env.SHOPIFY_CLIENT_SECRET;


/* =========================================================
   TEMPORARY CART STORAGE
========================================================= */

const carts = new Map();


/* =========================================================
   HOME
========================================================= */

app.get("/", (req, res) => {

    res.send(
        "TopUpMandu Custom Checkout Backend is running!"
    );

});


/* =========================================================
   CHECKOUT PAGE
========================================================= */

app.get("/checkout", (req, res) => {

    res.sendFile(
        path.join(
            __dirname,
            "checkout.html"
        )
    );

});


/* =========================================================
   SHOPIFY TOKEN
========================================================= */

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


/* =========================================================
   TEST SHOPIFY
========================================================= */

app.get(
    "/test-shopify",
    async (req, res) => {

        try {

            await getShopifyToken();

            res.json({

                success: true,

                message:
                    "Successfully connected to Shopify!"

            });

        } catch (error) {

            console.error(
                "TEST SHOPIFY ERROR:",
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


/* =========================================================
   SAVE CART
========================================================= */

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

                    success: false,

                    error:
                        "Invalid cart data."

                });

            }


            if (
                cart.items.length === 0
            ) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Cart is empty."

                });

            }


            const cartId =
                crypto.randomUUID();


            carts.set(

                cartId,

                {

                    cart: cart,

                    createdAt:
                        Date.now()

                }

            );


            /* Remove carts older than 30 minutes */

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

                success: true,

                cartId:
                    cartId

            });


        } catch (error) {

            console.error(
                "SAVE CART ERROR:",
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


/* =========================================================
   GET CART
========================================================= */

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

                    success: false,

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

                    success: false,

                    error:
                        "Cart has expired."

                });

            }


            res.json({

                success: true,

                cart:
                    stored.cart

            });


        } catch (error) {

            console.error(
                "GET CART ERROR:",
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


/* =========================================================
   UPLOAD PAYMENT SCREENSHOT
========================================================= */

app.post(
    "/upload-payment-screenshot",
    upload.single("paymentScreenshot"),
    async (req, res) => {

        try {

            if (!req.file) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Payment screenshot is required."

                });

            }


            const uploadResult =
                await new Promise(
                    (resolve, reject) => {

                        const stream =
                            cloudinary
                                .uploader
                                .upload_stream(

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

                                            resolve(result);

                                        }

                                    }

                                );


                        stream.end(
                            req.file.buffer
                        );

                    }
                );


            res.json({

                success: true,

                screenshotUrl:
                    uploadResult.secure_url

            });


        } catch (error) {

            console.error(
                "SCREENSHOT UPLOAD ERROR:",
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


/* =========================================================
   CREATE SHOPIFY ORDER
========================================================= */

/*
 IMPORTANT:
 upload.single("paymentScreenshot") is placed here.

 This allows the route to receive:

 - normal JSON requests
 - FormData requests
 - paymentScreenshot files
*/

app.post(
    "/create-order",
    upload.single("paymentScreenshot"),
    async (req, res) => {

        try {

            console.log(
                "CREATE ORDER REQUEST RECEIVED"
            );

            console.log(
                "Content-Type:",
                req.headers["content-type"]
            );

            console.log(
                "Body:",
                req.body
            );

            console.log(
                "File:",
                req.file
                    ? req.file.originalname
                    : "No screenshot"
            );


            /*
             * SAFETY CHECK
             */

            if (!req.body) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Request body is missing."

                });

            }


            /* =================================================
               READ REQUEST DATA
            ================================================= */

            let customer =
                req.body.customer;

            let items =
                req.body.items;

            const playerId =
                req.body.playerId || "";

            const region =
                req.body.region || "";

            const paymentMethod =
                req.body.paymentMethod || "";

            const paymentScreenshot =
                req.body.paymentScreenshot || "";


            /* =================================================
               PARSE FORM DATA STRINGS
            ================================================= */

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

            } catch (parseError) {

                console.error(
                    "JSON PARSE ERROR:",
                    parseError
                );


                return res.status(400).json({

                    success: false,

                    error:
                        "Invalid customer or cart data."

                });

            }


            /* =================================================
               VALIDATE CUSTOMER
            ================================================= */

            if (
                !parsedCustomer ||
                typeof parsedCustomer !==
                "object"
            ) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Customer information is required."

                });

            }


            /* =================================================
               VALIDATE ITEMS
            ================================================= */

            if (
                !parsedItems ||
                !Array.isArray(parsedItems) ||
                parsedItems.length === 0
            ) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Cart items are required."

                });

            }


            /* =================================================
               UPLOAD SCREENSHOT TO CLOUDINARY
            ================================================= */

            let screenshotUrl =
                "";


            if (req.file) {

                console.log(
                    "Uploading screenshot to Cloudinary..."
                );


                screenshotUrl =
                    await new Promise(
                        (resolve, reject) => {

                            const stream =
                                cloudinary
                                    .uploader
                                    .upload_stream(

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

                                                reject(
                                                    error
                                                );

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


                console.log(
                    "Screenshot uploaded:",
                    screenshotUrl
                );

            }


            /*
             * If frontend sends screenshot URL instead
             * of uploading directly, use it.
             */

            if (
                !screenshotUrl &&
                paymentScreenshot
            ) {

                screenshotUrl =
                    paymentScreenshot;

            }


            /* =================================================
               SHOPIFY TOKEN
            ================================================= */

            const accessToken =
                await getShopifyToken();


            /* =================================================
               SHOPIFY LINE ITEMS
            ================================================= */

            const lineItems =
                parsedItems.map(
                    item => {

                        const variantId =
                            item.variant_id ||
                            item.variantId ||
                            item.variant_id;


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

                                ? String(
                                    variantId
                                )

                                : `gid://shopify/ProductVariant/${variantId}`;


                        const properties = [];


                        /*
                         * PLAYER ID
                         */

                        if (playerId) {

                            properties.push({

                                name:
                                    "Player ID",

                                value:
                                    String(
                                        playerId
                                    )

                            });

                        }


                        /*
                         * REGION
                         */

                        if (region) {

                            properties.push({

                                name:
                                    "Region",

                                value:
                                    String(
                                        region
                                    )

                            });

                        }


                        /*
                         * PAYMENT METHOD
                         */

                        if (paymentMethod) {

                            properties.push({

                                name:
                                    "Payment Method",

                                value:
                                    String(
                                        paymentMethod
                                    )

                            });

                        }


                        return {

                            variantId:
                                variantGid,

                            quantity:
                                Number(
                                    item.quantity
                                ) || 1,

                            properties:
                                properties

                        };

                    }
                );


            /* =================================================
               SHOPIFY ORDER MUTATION
            ================================================= */

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


            /* =================================================
               CREATE ORDER OBJECT
            ================================================= */

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


            /* =================================================
               CUSTOMER EMAIL
            ================================================= */

            if (
                parsedCustomer.email
            ) {

                order.email =
                    String(
                        parsedCustomer.email
                    );

            }


            /* =================================================
               CUSTOMER PHONE
            ================================================= */

            if (
                parsedCustomer.phone
            ) {

                order.phone =
                    String(
                        parsedCustomer.phone
                    );

            }


            /* =================================================
               CUSTOMER NAME IN NOTE
            ================================================= */

            if (
                parsedCustomer.name
            ) {

                order.note +=
                    "\nCustomer Name: " +
                    String(
                        parsedCustomer.name
                    );

            }


            /* =================================================
               PAYMENT SCREENSHOT
            ================================================= */

            if (screenshotUrl) {

                order.note +=
                    "\nPayment Screenshot: " +
                    screenshotUrl;

            }


            /* =================================================
               ORDER CUSTOM ATTRIBUTES
            ================================================= */

            const attributes = [];


            /*
             * PAYMENT METHOD
             */

            attributes.push({

                key:
                    "Payment Method",

                value:
                    paymentMethod ||
                    "Not provided"

            });


            /*
             * PLAYER ID
             */

            if (playerId) {

                attributes.push({

                    key:
                        "Player ID",

                    value:
                        String(
                            playerId
                        )

                });

            }


            /*
             * REGION
             */

            if (region) {

                attributes.push({

                    key:
                        "Region",

                    value:
                        String(
                            region
                        )

                });

            }


            /*
             * PAYMENT SCREENSHOT
             */

            if (screenshotUrl) {

                attributes.push({

                    key:
                        "Payment Screenshot",

                    value:
                        screenshotUrl

                });

            }


            order.customAttributes =
                attributes;


            /* =================================================
               SEND ORDER TO SHOPIFY
            ================================================= */

            console.log(
                "Sending order to Shopify..."
            );


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
                "SHOPIFY RESPONSE:",
                JSON.stringify(
                    result,
                    null,
                    2
                )
            );


            /* =================================================
               GRAPHQL ERROR
            ================================================= */

            if (result.errors) {

                return res.status(500).json({

                    success: false,

                    error:
                        result.errors

                });

            }


            /* =================================================
               ORDER RESULT
            ================================================= */

            const orderResult =
                result.data?.orderCreate;


            if (
                !orderResult
            ) {

                return res.status(500).json({

                    success: false,

                    error:
                        "Shopify did not return an order result."

                });

            }


            /* =================================================
               SHOPIFY USER ERRORS
            ================================================= */

            if (
                orderResult.userErrors &&
                orderResult.userErrors.length > 0
            ) {

                console.error(
                    "SHOPIFY USER ERRORS:",
                    orderResult.userErrors
                );


                return res.status(400).json({

                    success: false,

                    errors:
                        orderResult.userErrors

                });

            }


            /* =================================================
               SUCCESS
            ================================================= */

            console.log(
                "ORDER CREATED:",
                orderResult.order
            );


            res.json({

                success: true,

                message:
                    "Order created successfully!",

                screenshotUrl:
                    screenshotUrl || null,

                order:
                    orderResult.order

            });


        } catch (error) {

            console.error(
                "===================================="
            );

            console.error(
                "CREATE ORDER ERROR:"
            );

            console.error(error);

            console.error(
                "===================================="
            );


            res.status(500).json({

                success: false,

                error:
                    error.message ||
                    "Order creation failed."

            });

        }

    }
);


/* =========================================================
   MULTER ERROR HANDLER
========================================================= */

app.use(
    (error, req, res, next) => {

        console.error(
            "GLOBAL ERROR:",
            error
        );


        if (
            error instanceof
            multer.MulterError
        ) {

            return res.status(400).json({

                success: false,

                error:
                    "Screenshot upload failed: " +
                    error.message

            });

        }


        if (
            error &&
            error.message ===
            "Only JPG, PNG and WEBP images are allowed."
        ) {

            return res.status(400).json({

                success: false,

                error:
                    error.message

            });

        }


        next(error);

    }
);


/* =========================================================
   START SERVER
========================================================= */

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