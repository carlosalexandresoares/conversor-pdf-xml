const express = require('express');
const path = require('node:path');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get("/api\status", (req, res) => {
    res.json({
        funcionando: true,
        sistema: "Conversor PDF para XML",
    });
});

app.listen(PORT, "0.0.0.0",  () => {
    console.log(`Sistema disponível em http://localhost:${PORT}`);
});

