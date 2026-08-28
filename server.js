const express = require("express");

const app = express();

app.use(express.json());

const SHOPIFY_SHOP = process.env.SHOPIFY_SHOP;
const SHOPIFY_CLIENT_ID = process.env.SHOPIFY_CLIENT_ID;
const SHOPIFY_CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET;


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

        if (!SHOPIFY_SHOP || !SHOPIFY_CLIENT_ID || !SHOPIFY_CLIENT_SECRET) {
            return res.status(500).json({
                success: false,
                error: "Shopify environment variables are missing."
            });
        }

        const tokenResponse = await fetch(
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

        const tokenData = await tokenResponse.json();

        if (!tokenResponse.ok) {
            return res.status(tokenResponse.status).json({
                success: false,
                error: tokenData
            });
        }

        res.json({
            success: true,
            message: "Successfully connected to Shopify!"
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            error: "Shopify connection failed."
        });

    }
});


// ===============================
// CREATE ORDER TEST
// ===============================

app.post("/create-order", (req, res) => {

    console.log("Order received:", req.body);

    res.json({
        success: true,
        message: "Order data received"
    });

});


// ===============================
// START SERVER
// ===============================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {

    console.log(
        `TopUpMandu backend running on port ${PORT}`
    );

});