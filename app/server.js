const express = require('express');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const { createHtmlInImg } = require('../lib/helper');
const fileUpload = require('../lib/index');
const app = express();

const PORT = process.env.PORT;
const MODE = process.env.NODE_ENV;
const WRITE_PATH = process.env.WRITE_PATH;
const DOMAIN = process.env.DOMAIN;

app.use(fileUpload());

app.use('/form', express.static(__dirname + '/index.html'));

app.get('/ping', function (req, res) {
  res.send('pong');
});

app.post('/upload', function (req, res) {
  try {
    let file;
    let uploadPath;

    if (!req.files || Object.keys(req.files).length === 0) {
      res.status(400).send('No files were uploaded.');
      return;
    }

    file = req.files.file;
    uploadPath = path.resolve(__dirname, WRITE_PATH + file.name);

    const fileCheck = fs.existsSync(uploadPath);
    if (fileCheck) {
      return res.status(400).json({
        success: false,
        error: 'file_already_exists',
      });
    }

    file.mv(uploadPath, function (err) {
      if (err) {
        return res.status(500).send(err);
      }

      res.json({
        success: true,
        path: uploadPath,
        message: 'file_uploaded',
      });
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error,
    });
  }
});

app.get('/images/*', function (req, res) {
  try {
    const filePath = req.path.replace('/images/', '');

    const fileDirectory = path.resolve(__dirname, WRITE_PATH + filePath);

    var data = fs.readFileSync(fileDirectory);
    res.contentType('image/jpeg');
    res.send(data);

    // download
    // res.download(fileDirectory);
    // res.sendFile(fileDirectory);
  } catch (error) {
    return res.status(400).json({
      success: false,
      error,
    });
  }
});

app.listen(PORT, function () {
  console.log('Express server listening on port ', PORT); // eslint-disable-line
});
