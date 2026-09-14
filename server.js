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

app.use(express.static(__dirname));

/* =========================================================
   CORS
========================================================= */

app.use((req, res, next) => {
    const origin = req.headers.origin;

    const allowedOrigins = [
        "https://topupmandu.com",
        "https://www.topupmandu.com"
    ];

    if (origin && allowedOrigins.includes(origin)) {
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
        "Content-Type, Accept"
    );

    res.setHeader(
        "Access-Control-Allow-Credentials",
        "false"
    );

    if (req.method === "OPTIONS") {
        return res.status(204).end();
    }

    next();
});

/* =========================================================
   ENVIRONMENT VARIABLES
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
   API BASE URLS
========================================================= */

const HL_GAMING_API_BASE =
    "https://proapis.hlgamingofficial.com";

const GAMES_KINBO_API_BASE =
    "https://api.gameskinbo.com";

const HL_GAMING_SECTION =
    "freefireValidation";

/* =========================================================
   HOME
========================================================= */

app.get("/", (req, res) => {
    res.status(200).send(
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
   DEBUG FREE FIRE ENVIRONMENT
========================================================= */

app.get("/debug-free-fire", (req, res) => {
    const key =
        process.env.FREE_FIRE_API_KEY;

    const hlUserUid =
        process.env.HL_GAMING_USER_UID;

    const hlApiKey =
        process.env.HL_GAMING_API_KEY;

    res.json({
        success: true,

        gamesKinbo: {
            configured: !!key,
            keyLength: key ? key.length : 0,
            keyPrefix: key
                ? key.substring(0, 4)
                : null
        },

        hlGaming: {
            configured:
                !!(
                    hlUserUid &&
                    hlApiKey
                ),

            userUidConfigured:
                !!hlUserUid,

            apiKeyConfigured:
                !!hlApiKey,

            apiKeyLength:
                hlApiKey
                    ? hlApiKey.length
                    : 0
        }
    });
});

/* =========================================================
   DEBUG GAMES KINBO CONNECTION
========================================================= */

app.get(
    "/debug-free-fire-provider",
    async (req, res) => {
        try {
            const apiKey =
                process.env.FREE_FIRE_API_KEY;

            if (!apiKey) {
                return res.status(500).json({
                    success: false,
                    error:
                        "FREE_FIRE_API_KEY missing."
                });
            }

            const url =
                new URL(
                    `${GAMES_KINBO_API_BASE}/ff-info/get`
                );

            url.searchParams.set(
                "uid",
                "1589593213"
            );

            console.log(
                "[DEBUG] Calling Games Kinbo:",
                url.toString()
            );

            const response =
                await fetch(
                    url.toString(),
                    {
                        method: "GET",

                        headers: {
                            "x-api-key":
                                apiKey,

                            "Accept":
                                "application/json",

                            "User-Agent":
                                "TopUpMandu/1.0"
                        },

                        signal:
                            AbortSignal.timeout(
                                15000
                            )
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

            return res.status(200).json({
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
                    error.message,

                errorName:
                    error.name
            });
        }
    }
);

/* =========================================================
   DEBUG HL GAMING CONNECTION
========================================================= */

app.get(
    "/debug-hl-gaming",
    async (req, res) => {
        try {
            const userUid =
                process.env.HL_GAMING_USER_UID;

            const apiKey =
                process.env.HL_GAMING_API_KEY;

            if (!userUid || !apiKey) {
                return res.status(500).json({
                    success: false,

                    error:
                        "HL Gaming credentials are missing."
                });
            }

            const url =
                new URL(
                    `${HL_GAMING_API_BASE}/main/games/freefire/validation/api`
                );

            url.searchParams.set(
                "sectionName",
                HL_GAMING_SECTION
            );

            url.searchParams.set(
                "useruid",
                userUid
            );

            url.searchParams.set(
                "api",
                apiKey
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
                "[HL DEBUG] Calling HL Gaming..."
            );

            const response =
                await fetch(
                    url.toString(),
                    {
                        method: "GET",

                        headers: {
                            "Accept":
                                "application/json",

                            "User-Agent":
                                "TopUpMandu/1.0"
                        },

                        signal:
                            AbortSignal.timeout(
                                15000
                            )
                    }
                );

            const text =
                await response.text();

            console.log(
                "[HL DEBUG] Status:",
                response.status
            );

            console.log(
                "[HL DEBUG] Response:",
                text
            );

            return res.status(200).json({
                success:
                    response.ok,

                providerStatus:
                    response.status,

                providerResponse:
                    text
            });

        } catch (error) {
            console.error(
                "[HL DEBUG ERROR]",
                error
            );

            return res.status(500).json({
                success: false,

                error:
                    error.message,

                errorName:
                    error.name
            });
        }
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
               HL GAMING CREDENTIALS
            ------------------------------------------------- */

            const userUid =
                process.env.HL_GAMING_USER_UID;

            const apiKey =
                process.env.HL_GAMING_API_KEY;

            if (!userUid || !apiKey) {
                console.error(
                    "HL_GAMING_USER_UID or HL_GAMING_API_KEY is missing."
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
                    )
                        .trim()
                        .toUpperCase();
            }

            /*
             * If frontend doesn't send a region,
             * use BD for backward compatibility.
             */

            if (!region) {
                region = "BD";
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
               VALIDATE REGION
            ------------------------------------------------- */

            const allowedRegions = [
                "IND",
                "EU",
                "NP",
                "BD",
                "SG",
                "ME",
                "TH",
                "VN",
                "ID",
                "TW",
                "RU",
                "PK",
                "US"
            ];

            if (
                !allowedRegions.includes(
                    region
                )
            ) {
                return res.status(400).json({
                    success: false,

                    error:
                        "Invalid Free Fire region."
                });
            }

            /* -------------------------------------------------
               BUILD HL GAMING URL
            ------------------------------------------------- */

            const url =
                new URL(
                    `${HL_GAMING_API_BASE}/main/games/freefire/validation/api`
                );

            url.searchParams.set(
                "sectionName",
                HL_GAMING_SECTION
            );

            url.searchParams.set(
                "useruid",
                userUid
            );

            url.searchParams.set(
                "api",
                apiKey
            );

            url.searchParams.set(
                "uid",
                uid
            );

            url.searchParams.set(
                "region",
                region
            );

            console.log(
                "[FREE FIRE] Verifying UID:",
                uid
            );

            console.log(
                "[FREE FIRE] Region:",
                region
            );

            /* -------------------------------------------------
               REQUEST WITH TIMEOUT
            ------------------------------------------------- */

            const controller =
                new AbortController();

            const timeout =
                setTimeout(
                    () => controller.abort(),
                    15000
                );

            let response;

            try {
                response =
                    await fetch(
                        url.toString(),
                        {
                            method: "GET",

                            headers: {
                                "Accept":
                                    "application/json",

                                "User-Agent":
                                    "TopUpMandu/1.0"
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
               READ PROVIDER RESPONSE
            ------------------------------------------------- */

            const responseText =
                await response.text();

            let data = null;

            try {
                data =
                    JSON.parse(
                        responseText
                    );
            } catch {
                data = null;
            }

            console.log(
                "[FREE FIRE] HL Gaming status:",
                response.status
            );

            console.log(
                "[FREE FIRE] HL Gaming response:",
                responseText
            );

            /* -------------------------------------------------
               PROVIDER ERROR
            ------------------------------------------------- */

            if (!response.ok) {
                console.error(
                    "[FREE FIRE] HL Gaming error:",
                    responseText
                );

                if (
                    response.status === 400
                ) {
                    return res.status(400).json({
                        success: false,

                        error:
                            data?.result?.message ||
                            data?.message ||
                            "Invalid Free Fire verification request.",

                        providerStatus:
                            response.status
                    });
                }

                if (
                    response.status === 403
                ) {
                    return res.status(500).json({
                        success: false,

                        error:
                            "Free Fire verification API credentials are invalid or revoked.",

                        providerStatus:
                            response.status
                    });
                }

                if (
                    response.status === 429
                ) {
                    return res.status(429).json({
                        success: false,

                        error:
                            "Free Fire verification limit reached. Please try again later.",

                        providerStatus:
                            response.status
                    });
                }

                return res.status(500).json({
                    success: false,

                    error:
                        data?.result?.message ||
                        data?.message ||
                        "Unable to verify the Free Fire Player ID right now.",

                    providerStatus:
                        response.status
                });
            }

            /* -------------------------------------------------
               VALIDATE HL GAMING RESPONSE
            ------------------------------------------------- */

            const result =
                data?.result;

            if (!result) {
                console.error(
                    "[FREE FIRE] Unexpected HL Gaming response:",
                    data
                );

                return res.status(502).json({
                    success: false,

                    error:
                        "Free Fire verification provider returned an unexpected response."
                });
            }

            /* -------------------------------------------------
               INVALID PLAYER
            ------------------------------------------------- */

            if (
                result.valid !== true
            ) {
                return res.status(404).json({
                    success: false,

                    verified: false,

                    error:
                        result.message ||
                        "Player not found. Please check your Player ID."
                });
            }

            /* -------------------------------------------------
               PLAYER INFORMATION
            ------------------------------------------------- */

            const nickname =
                result.AccountName
                    ? String(
                        result.AccountName
                    )
                    : "";

            const accountLevel =
                result.AccountLevel != null
                    ? Number(
                        result.AccountLevel
                    )
                    : null;

            const accountRegion =
                result.AccountRegion
                    ? String(
                        result.AccountRegion
                    ).toUpperCase()
                    : region;

            /* -------------------------------------------------
               SUCCESS
            ------------------------------------------------- */

            console.log(
                "[FREE FIRE] PLAYER VERIFIED:",
                nickname,
                "|",
                accountRegion,
                "| Level:",
                accountLevel
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

            return res.json({
                success: true,

                message:
                    "Successfully connected to Shopify!"
            });

        } catch (error) {
            console.error(
                "TEST SHOPIFY ERROR:",
                error
            );

            return res.status(500).json({
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
                !Array.isArray(
                    cart.items
                )
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
                    carts.delete(
                        id
                    );
                }
            }

            return res.json({
                success: true,

                cartId:
                    cartId
            });

        } catch (error) {
            console.error(
                "SAVE CART ERROR:",
                error
            );

            return res.status(500).json({
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

            return res.json({
                success: true,

                cart:
                    stored.cart
            });

        } catch (error) {
            console.error(
                "GET CART ERROR:",
                error
            );

            return res.status(500).json({
                success: false,

                error:
                    error.message
            });
        }
    }
);

/* =========================================================
   CLOUDINARY UPLOAD HELPER
========================================================= */

function uploadBufferToCloudinary(
    buffer
) {
    return new Promise(
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
                buffer
            );
        }
    );
}

/* =========================================================
   UPLOAD PAYMENT SCREENSHOT
========================================================= */

app.post(
    "/upload-payment-screenshot",
    upload.single(
        "paymentScreenshot"
    ),
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
                await uploadBufferToCloudinary(
                    req.file.buffer
                );

            return res.json({
                success: true,

                screenshotUrl:
                    uploadResult.secure_url
            });

        } catch (error) {
            console.error(
                "SCREENSHOT UPLOAD ERROR:",
                error
            );

            return res.status(500).json({
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
    upload.single(
        "paymentScreenshot"
    ),
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
                req.headers[
                "content-type"
                ]
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
                req.body.playerId ||
                "";

            const region =
                req.body.region ||
                "";

            const paymentMethod =
                req.body.paymentMethod ||
                "";

            const paymentScreenshot =
                req.body.paymentScreenshot ||
                "";

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
                        JSON.parse(
                            customer
                        );
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
                        JSON.parse(
                            items
                        );
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
                !Array.isArray(
                    parsedItems
                ) ||
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
                    parsedCustomer.name ||
                    ""
                ).trim();

            const customerEmail =
                String(
                    parsedCustomer.email ||
                    ""
                ).trim();

            const customerPhone =
                String(
                    parsedCustomer.phone ||
                    ""
                ).trim();

            /* =================================================
               SPLIT CUSTOMER NAME
            ================================================= */

            let firstName =
                customerName;

            let lastName =
                "";

            if (
                customerName.includes(
                    " "
                )
            ) {
                const nameParts =
                    customerName.split(
                        /\s+/
                    );

                firstName =
                    nameParts.shift();

                lastName =
                    nameParts.join(
                        " "
                    );
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

                const uploadResult =
                    await uploadBufferToCloudinary(
                        req.file.buffer
                    );

                screenshotUrl =
                    uploadResult.secure_url;

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

                        const properties =
                            [];

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
                                    value !==
                                    null &&
                                    value !==
                                    undefined &&
                                    String(
                                        value
                                    ).trim() !==
                                    ""
                                ) {
                                    properties.push({
                                        name:
                                            String(
                                                key
                                            ),

                                        value:
                                            String(
                                                value
                                            )
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
                                        .replace(
                                            /\s+/g,
                                            ""
                                        ) ===
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
                                        .replace(
                                            /\s+/g,
                                            ""
                                        ) ===
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
                            properties.length >
                            0
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
                const customerData =
                    {};

                if (
                    customerEmail
                ) {
                    customerData.email =
                        customerEmail;
                }

                if (
                    customerPhone
                ) {
                    customerData.phone =
                        customerPhone;
                }

                if (
                    firstName
                ) {
                    customerData.firstName =
                        firstName;
                }

                if (
                    lastName
                ) {
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

            if (
                customerEmail
            ) {
                order.email =
                    customerEmail;
            }

            /* =================================================
               PHONE
            ================================================= */

            if (
                customerPhone
            ) {
                order.phone =
                    customerPhone;
            }

            /* =================================================
               ORDER ADDITIONAL DETAILS
            ================================================= */

            const attributes =
                [];

            /* PAYMENT METHOD */

            if (
                paymentMethod
            ) {
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

            if (
                playerId
            ) {
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

            if (
                region
            ) {
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

            if (
                screenshotUrl
            ) {
                attributes.push({
                    key:
                        "Payment Screenshot",

                    value:
                        screenshotUrl
                });
            }

            if (
                attributes.length >
                0
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
                        method: "POST",

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
                orderResult.userErrors.length >
                0
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

            return res.json({
                success: true,

                message:
                    "Order created successfully!",

                screenshotUrl:
                    screenshotUrl ||
                    null,

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

            return res.status(500).json({
                success: false,

                error:
                    error.message ||
                    "Order creation failed."
            });
        }
    }
);

/* =========================================================
   MULTER / GLOBAL ERROR HANDLER
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

        return res.status(500).json({
            success: false,

            error:
                error.message ||
                "Internal server error."
        });
    }
);

/* =========================================================
   404 HANDLER
========================================================= */

app.use(
    (req, res) => {
        return res.status(404).json({
            success: false,

            error:
                "Endpoint not found.",

            path:
                req.path
        });
    }
);

/* =========================================================
   VERCEL EXPORT
========================================================= */

module.exports = app;