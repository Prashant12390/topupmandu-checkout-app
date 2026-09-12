require("dotenv").config();

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
   EXPRESS BODY PARSERS
========================================================= */

app.use(
    express.json({
        limit: "2mb"
    })
);

app.use(
    express.urlencoded({
        extended: true,
        limit: "2mb"
    })
);

app.use(
    express.static(__dirname)
);


/* =========================================================
   CORS
   Allows TopUpMandu website to call Free Fire verification
========================================================= */

app.use((req, res, next) => {

    const allowedOrigins = [
        "https://topupmandu.com",
        "https://www.topupmandu.com"
    ];

    const origin = req.headers.origin;

    if (allowedOrigins.includes(origin)) {

        res.setHeader(
            "Access-Control-Allow-Origin",
            origin
        );

    }

    res.setHeader(
        "Access-Control-Allow-Methods",
        "GET, POST, OPTIONS"
    );

    res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type"
    );

    if (req.method === "OPTIONS") {

        return res.sendStatus(204);

    }

    next();

});


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
   FREE FIRE - GAMES KINBO API
========================================================= */

const GAMES_KINBO_API_BASE =
    "https://api.gameskinbo.com";


/* =========================================================
   FREE FIRE VERIFICATION STATUS
========================================================= */
app.get("/debug-free-fire", (req, res) => {
    const key = process.env.FREE_FIRE_API_KEY;

    res.json({
        configured: !!key,
        keyLength: key ? key.length : 0,
        keyPrefix: key ? key.substring(0, 4) : null
    });
});


/* =========================================================
   DEBUG GAMES KINBO CONNECTION FROM VERCEL
========================================================= */

app.get("/debug-free-fire-provider", async (req, res) => {

    try {

        const apiKey =
            process.env.FREE_FIRE_API_KEY;

        if (!apiKey) {

            return res.status(500).json({
                success: false,
                error: "FREE_FIRE_API_KEY is missing."
            });

        }

        const url = new URL(
            "https://api.gameskinbo.com/ff-info/get"
        );

        url.searchParams.set(
            "uid",
            "1589593213"
        );

        url.searchParams.set(
            "region",
            "BD"
        );


        console.log(
            "[DEBUG] Games Kinbo URL:",
            url.toString()
        );

        console.log(
            "[DEBUG] API key configured:",
            !!apiKey
        );

        console.log(
            "[DEBUG] API key length:",
            apiKey.length
        );


        const response = await fetch(
            url.toString(),
            {
                method: "GET",

                headers: {
                    "x-api-key": apiKey,
                    "Accept": "application/json",
                    "User-Agent": "TopUpMandu/1.0"
                }
            }
        );


        const text =
            await response.text();


        console.log(
            "[DEBUG] Games Kinbo status:",
            response.status
        );

        console.log(
            "[DEBUG] Games Kinbo response:",
            text
        );


        return res.json({

            success:
                response.ok,

            providerStatus:
                response.status,

            providerResponse:
                text

        });


    } catch (error) {

        console.error(
            "[DEBUG PROVIDER ERROR]",
            error
        );


        return res.status(500).json({

            success: false,

            error:
                error.message

        });

    }

});


app.get(
    "/verify-free-fire",
    (req, res) => {

        res.json({

            success: true,

            service:
                "TopUpMandu Free Fire UID Verification",

            provider:
                "Games Kinbo",

            status:
                "online"

        });

    }
);


/* =========================================================
   FREE FIRE PLAYER VERIFICATION
========================================================= */

app.post(
    "/verify-free-fire",
    async (req, res) => {

        try {

            /* -------------------------------------------------
               API KEY
            ------------------------------------------------- */

            const apiKey =
                process.env.FREE_FIRE_API_KEY;


            if (!apiKey) {

                console.error(
                    "FREE_FIRE_API_KEY is missing."
                );

                return res.status(500).json({

                    success: false,

                    error:
                        "Free Fire verification is not configured."

                });

            }


            /* -------------------------------------------------
               READ REQUEST
            ------------------------------------------------- */

            let uid =
                req.body?.uid;

            let region =
                req.body?.region;


            uid =
                String(
                    uid || ""
                ).trim();


            if (region) {

                region =
                    String(
                        region
                    ).trim().toUpperCase();

            }


            /* -------------------------------------------------
               VALIDATE UID
            ------------------------------------------------- */

            if (!uid) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Please enter your Free Fire Player ID."

                });

            }


            if (!/^\d{5,15}$/.test(uid)) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Player ID must contain 5-15 digits."

                });

            }


            /* -------------------------------------------------
               BUILD GAMES KINBO URL
            ------------------------------------------------- */

            const url =
                new URL(
                    `${GAMES_KINBO_API_BASE}/ff-info/get`
                );


            url.searchParams.set(
                "uid",
                uid
            );


            /*
             * Region is optional.
             *
             * If region is not supplied,
             * Games Kinbo automatically tries
             * supported regions.
             */

            if (region) {

                url.searchParams.set(
                    "region",
                    region
                );

            }


            console.log(
                "[FREE FIRE] Verifying UID:",
                uid
            );


            if (region) {

                console.log(
                    "[FREE FIRE] Region:",
                    region
                );

            } else {

                console.log(
                    "[FREE FIRE] Region: automatic"
                );

            }


            /* -------------------------------------------------
               API REQUEST TIMEOUT
            ------------------------------------------------- */

            const controller =
                new AbortController();


            const timeout =
                setTimeout(
                    () => controller.abort(),
                    10000
                );


            let response;


            try {

                response =
                    await fetch(
                        url.toString(),
                        {

                            method: "GET",

                            headers: {

                                "x-api-key":
                                    apiKey,

                                "Accept":
                                    "application/json"

                            },

                            signal:
                                controller.signal

                        }
                    );

            } finally {

                clearTimeout(
                    timeout
                );

            }


            /* -------------------------------------------------
               READ API RESPONSE
            ------------------------------------------------- */

            let data = null;


            try {

                data =
                    await response.json();

            } catch {

                data = null;

            }


            console.log(
                "[FREE FIRE] Games Kinbo status:",
                response.status
            );


            /* -------------------------------------------------
               API ERROR
            ------------------------------------------------- */

            if (!response.ok) {

                console.error(
                    "[FREE FIRE] Games Kinbo error:",
                    data
                );


                /* Invalid UID */

                if (response.status === 402) {

                    return res.status(404).json({

                        success: false,

                        error:
                            "Player not found. Please check your Player ID."

                    });

                }


                /* Unauthorized */

                if (response.status === 401) {

                    return res.status(500).json({

                        success: false,

                        error:
                            "Free Fire verification API key is invalid."

                    });

                }


                /* Rate limit */

                if (response.status === 429) {

                    return res.status(429).json({

                        success: false,

                        error:
                            "Free Fire verification is temporarily busy. Please try again in a moment."

                    });

                }


                return res.status(500).json({

                    success: false,

                    error:
                        data?.error ||
                        data?.message ||
                        "Unable to verify the Free Fire Player ID right now.",

                    providerStatus:
                        response.status,

                    providerResponse:
                        data

                });
            }


            /* -------------------------------------------------
               VALIDATE RESPONSE
            ------------------------------------------------- */

            if (
                !data ||
                !data.AccountInfo
            ) {

                console.error(
                    "[FREE FIRE] Unexpected API response:",
                    data
                );


                return res.status(404).json({

                    success: false,

                    error:
                        "Player not found. Please check your Player ID."

                });

            }


            /* -------------------------------------------------
               PLAYER INFORMATION
            ------------------------------------------------- */

            const accountInfo =
                data.AccountInfo;


            const nickname =
                accountInfo.AccountName
                    ? String(
                        accountInfo.AccountName
                    )
                    : "";


            const accountLevel =
                accountInfo.AccountLevel != null
                    ? Number(
                        accountInfo.AccountLevel
                    )
                    : null;


            const accountRegion =
                accountInfo.AccountRegion
                    ? String(
                        accountInfo.AccountRegion
                    ).toUpperCase()
                    : (
                        region || ""
                    );


            /* -------------------------------------------------
               SUCCESS
            ------------------------------------------------- */

            console.log(
                "[FREE FIRE] PLAYER VERIFIED:",
                nickname,
                "|",
                accountRegion
            );


            return res.status(200).json({

                success: true,

                game:
                    "Free Fire",

                verified:
                    true,

                player: {

                    uid:
                        uid,

                    nickname:
                        nickname,

                    region:
                        accountRegion,

                    level:
                        accountLevel

                }

            });


        } catch (error) {

            console.error(
                "[FREE FIRE] UNEXPECTED ERROR:",
                error
            );


            if (
                error.name ===
                "AbortError"
            ) {

                return res.status(504).json({

                    success: false,

                    error:
                        "Free Fire verification timed out. Please try again."

                });

            }


            return res.status(500).json({

                success: false,

                error:
                    "Unable to verify the Player ID right now. Please try again."

            });

        }

    }
);


/* =========================================================
   HOME
========================================================= */

app.get(
    "/",
    (req, res) => {

        res.send(
            "TopUpMandu Custom Checkout Backend is running!"
        );

    }
);


/* =========================================================
   CHECKOUT PAGE
========================================================= */

app.get(
    "/checkout",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "checkout.html"
            )
        );

    }
);


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


    const response =
        await fetch(

            `https://${SHOPIFY_SHOP}.myshopify.com/admin/oauth/access_token`,

            {

                method: "POST",

                headers: {

                    "Content-Type":
                        "application/json"

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

                    cart:
                        cart,

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

                                            reject(
                                                error
                                            );

                                        } else {

                                            resolve(
                                                result
                                            );

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

app.post(
    "/create-order",
    upload.single("paymentScreenshot"),
    async (req, res) => {

        try {

            console.log(
                "======================================"
            );

            console.log(
                "TOPUPMANDU CREATE ORDER"
            );

            console.log(
                "======================================"
            );


            console.log(
                "Content-Type:",
                req.headers["content-type"]
            );


            console.log(
                "Request body:",
                req.body
            );


            console.log(
                "Screenshot:",
                req.file
                    ? req.file.originalname
                    : "No screenshot"
            );


            /* =================================================
               SAFETY CHECK
            ================================================= */

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
               PARSE CUSTOMER
            ================================================= */

            let parsedCustomer =
                customer;


            if (
                typeof customer ===
                "string"
            ) {

                try {

                    parsedCustomer =
                        JSON.parse(customer);

                } catch (error) {

                    return res.status(400).json({

                        success: false,

                        error:
                            "Invalid customer data."

                    });

                }

            }


            /* =================================================
               PARSE ITEMS
            ================================================= */

            let parsedItems =
                items;


            if (
                typeof items ===
                "string"
            ) {

                try {

                    parsedItems =
                        JSON.parse(items);

                } catch (error) {

                    return res.status(400).json({

                        success: false,

                        error:
                            "Invalid cart data."

                    });

                }

            }


            /* =================================================
               VALIDATE CUSTOMER
            ================================================= */

            if (
                !parsedCustomer ||
                typeof parsedCustomer !== "object"
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
               CUSTOMER INFORMATION
            ================================================= */

            const customerName =
                String(
                    parsedCustomer.name || ""
                ).trim();


            const customerEmail =
                String(
                    parsedCustomer.email || ""
                ).trim();


            const customerPhone =
                String(
                    parsedCustomer.phone || ""
                ).trim();


            /* =================================================
               SPLIT CUSTOMER NAME
            ================================================= */

            let firstName =
                customerName;


            let lastName =
                "";


            if (
                customerName.includes(" ")
            ) {

                const nameParts =
                    customerName.split(/\s+/);


                firstName =
                    nameParts.shift();


                lastName =
                    nameParts.join(" ");

            }


            /* =================================================
               UPLOAD SCREENSHOT
            ================================================= */

            let screenshotUrl =
                "";


            if (req.file) {

                console.log(
                    "Uploading payment screenshot..."
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
                    "Screenshot uploaded successfully."
                );

            }


            /* =================================================
               IF FRONTEND ALREADY SENT URL
            ================================================= */

            if (
                !screenshotUrl &&
                paymentScreenshot
            ) {

                screenshotUrl =
                    String(
                        paymentScreenshot
                    );

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

                                ? String(
                                    variantId
                                )

                                : `gid://shopify/ProductVariant/${variantId}`;


                        /* =====================================
                           PRESERVE PRODUCT PROPERTIES
                        ===================================== */

                        const properties = [];


                        if (
                            item.properties &&
                            typeof item.properties ===
                            "object"
                        ) {

                            for (
                                const [
                                    key,
                                    value
                                ]
                                of Object.entries(
                                    item.properties
                                )
                            ) {

                                if (
                                    value !== null &&
                                    value !== undefined &&
                                    String(value).trim() !== ""
                                ) {

                                    properties.push({

                                        name:
                                            String(key),

                                        value:
                                            String(value)

                                    });

                                }

                            }

                        }


                        /* =====================================
                           PLAYER ID
                        ===================================== */

                        const hasPlayerId =
                            properties.some(
                                property =>
                                    property.name
                                        .toLowerCase()
                                        .replace(/\s+/g, "") ===
                                    "playerid"
                            );


                        if (
                            playerId &&
                            !hasPlayerId
                        ) {

                            properties.push({

                                name:
                                    "Player ID",

                                value:
                                    String(
                                        playerId
                                    )

                            });

                        }


                        /* =====================================
                           REGION
                        ===================================== */

                        const hasRegion =
                            properties.some(
                                property =>
                                    property.name
                                        .toLowerCase()
                                        .replace(/\s+/g, "") ===
                                    "region"
                            );


                        if (
                            region &&
                            !hasRegion
                        ) {

                            properties.push({

                                name:
                                    "Region",

                                value:
                                    String(
                                        region
                                    )

                            });

                        }


                        /* =====================================
                           LINE ITEM
                        ===================================== */

                        const lineItem = {

                            variantId:
                                variantGid,

                            quantity:
                                Number(
                                    item.quantity
                                ) || 1

                        };


                        if (
                            properties.length > 0
                        ) {

                            lineItem.properties =
                                properties;

                        }


                        return lineItem;

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
               CLEAN SHOPIFY ORDER
            ================================================= */

            const order = {

                lineItems:
                    lineItems,

                note:
                    "TopUpMandu Custom Checkout",

                tags: [

                    "TopUpMandu",

                    "Custom Checkout"

                ]

            };


            /* =================================================
               CUSTOMER
            ================================================= */

            if (
                customerName ||
                customerEmail ||
                customerPhone
            ) {

                const customerData = {};


                if (customerEmail) {

                    customerData.email =
                        customerEmail;

                }


                if (customerPhone) {

                    customerData.phone =
                        customerPhone;

                }


                if (firstName) {

                    customerData.firstName =
                        firstName;

                }


                if (lastName) {

                    customerData.lastName =
                        lastName;

                }


                order.customer = {

                    toUpsert:
                        customerData

                };

            }


            /* =================================================
               EMAIL
            ================================================= */

            if (customerEmail) {

                order.email =
                    customerEmail;

            }


            /* =================================================
               PHONE
            ================================================= */

            if (customerPhone) {

                order.phone =
                    customerPhone;

            }


            /* =================================================
               ORDER ADDITIONAL DETAILS
            ================================================= */

            const attributes = [];


            /* PAYMENT METHOD */

            if (paymentMethod) {

                attributes.push({

                    key:
                        "Payment Method",

                    value:
                        String(
                            paymentMethod
                        )

                });

            }


            /* PLAYER ID */

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


            /* REGION */

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


            /* PAYMENT SCREENSHOT */

            if (screenshotUrl) {

                attributes.push({

                    key:
                        "Payment Screenshot",

                    value:
                        screenshotUrl

                });

            }


            if (
                attributes.length > 0
            ) {

                order.customAttributes =
                    attributes;

            }


            /* =================================================
               DEBUG
            ================================================= */

            console.log(
                "SHOPIFY ORDER PAYLOAD:"
            );


            console.log(
                JSON.stringify(
                    order,
                    null,
                    2
                )
            );


            /* =================================================
               SEND TO SHOPIFY
            ================================================= */

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
                "SHOPIFY RESPONSE:"
            );


            console.log(
                JSON.stringify(
                    result,
                    null,
                    2
                )
            );


            /* =================================================
               GRAPHQL ERRORS
            ================================================= */

            if (
                result.errors
            ) {

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
                    "SHOPIFY USER ERRORS:"
                );


                console.error(
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
                "======================================"
            );


            console.log(
                "ORDER CREATED SUCCESSFULLY"
            );


            console.log(
                "ORDER:",
                orderResult.order?.name
            );


            console.log(
                "======================================"
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
                "======================================"
            );


            console.error(
                "CREATE ORDER ERROR:"
            );


            console.error(
                error
            );


            console.error(
                "======================================"
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
            (
                error.message ===
                "Only JPG, PNG and WEBP images are allowed."
            )
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