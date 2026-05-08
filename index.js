const express = require('express');
const app = express();
const port = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

app.get('/', (req, res) => {
    res.send('this is the node app running in ' + NODE_ENV + ' environment');
});


app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`);
});