const express = require('express');
const path = require('path');
const fs = require('fs').promises;
require('dotenv').config();

const fileUpload = require('../lib/index');
const app = express();

const PORT = process.env.PORT;
const mode = process.env.NODE_ENV;
app.use('/form', express.static(__dirname + '/index.html'));
console.log('PORT', PORT);
console.log('mode', mode);
// default options
app.use(fileUpload());

app.get('/ping', function (req, res) {
  res.send('pong');
});

app.post('/upload', async function (req, res) {
  let file;
  let uploadPath;

  if (!req.files || Object.keys(req.files).length === 0) {
    res.status(400).send('No files were uploaded.');
    return;
  }

  console.log('req.files >>>', req.files); // eslint-disable-line

  file = req.files.file;

  uploadPath = path.resolve(__dirname, '../uploads/' + file.name);

  console.log('uploadPath', uploadPath);
  const fileStat = await fs.lstat(uploadPath);
  if (fileStat.isFile()) {
    return res.status(400).json({
      success: false,
      error: 'file_already_exists',
    });
  }

  file.mv(uploadPath, function (err) {
    if (err) {
      return res.status(500).send(err);
    }

    res.send('File uploaded to ' + uploadPath);
  });
});

app.listen(PORT, function () {
  console.log('Express server listening on port ', PORT); // eslint-disable-line
});
