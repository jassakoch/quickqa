const express = require("express");
const axios = require("axios");

const router = express.Router();

router.post("/check", async (req, res) => {
    // Debug log: show incoming body
    console.log('apiCheck handler - req.body =', req.body);

    // Guard against missing or non-JSON bodies
    const { url } = req.body || {};
    if (!url) {
        return res.status(400).json({
            message: 'Bad Request',
            detail: 'Request body must be JSON and include a "url" property'
        });
    }

    try {
        const start = Date.now();
        // Add a timeout so requests don't hang for minutes
        const response = await axios.get(url, { timeout: 8000 });
        const duration = Date.now() - start;
        return res.status(200).json({
            status: response.status,
            time: `${duration}ms`,
            message: "✅ API is reachable"
        });
    } catch (error) {
        // Log the underlying error for server-side diagnostics
        console.error('Upstream request error:', error && error.stack ? error.stack : error);

        // Timeout
        if (error.code === 'ECONNABORTED') {
            return res.status(504).json({ message: 'Upstream request timed out', error: error.message });
        }

        // Upstream returned a non-2xx response
        if (error.response) {
            return res.status(502).json({ message: 'Upstream returned an error', status: error.response.status, data: error.response.data });
        }

        // Other network/DNS errors
        return res.status(502).json({
            message: "❌ API request failed",
            error: error && error.message ? error.message : String(error)
        });
    }
});

module.exports = router;
