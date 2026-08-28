const express = require("express");

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
    res.send("TopUpMandu Custom Checkout Backend is running!");
});

app.post("/create-order", (req, res) => {
    console.log("Order received:", req.body);

    res.json({
        success: true,
        message: "Order data received"
    });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`TopUpMandu backend running on port ${PORT}`);
});