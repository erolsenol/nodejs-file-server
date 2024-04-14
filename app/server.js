const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { rateLimit } = require('express-rate-limit');
// const bodyParser = require('body-parser');
const hpp = require('hpp');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const { createFolder } = require('../lib/helper');
const fileUpload = require('../lib/index');
const app = express();

const PORT = process.env.PORT;
const MODE = process.env.NODE_ENV;
const WRITE_PATH = process.env.WRITE_PATH;
const DOMAIN = process.env.DOMAIN;

app.use(cors());
app.use(helmet());
app.use(fileUpload());
// app.use(bodyParser.urlencoded());
app.use(hpp());

const limiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  limit: 300, // Limit each IP to 100 requests per `window` (here, per 15 minutes).
  standardHeaders: 'RateLimit',
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers.
  // store: ... , // Redis, Memcached, etc. See below.
});
app.use(limiter);
app.disable('x-powered-by');

app.use('/form', express.static(__dirname + '/index.html'));

app.get('/ping', function (req, res) {
  res.send('pong');
});
app.get('/', function (req, res) {
  res.send('ok');
});

app.post('/upload', async function (req, res) {
  try {
    let file;
    let uploadPath;
    let { savepath = '' } = req.query;

    if (!req.files || Object.keys(req.files).length === 0) {
      res.status(400).send('No files were uploaded.');
      return;
    }

    file = req.files.file;
    uploadPath = path.resolve(__dirname, WRITE_PATH + savepath + file.name);

    const fileCheck = fs.existsSync(uploadPath);
    if (fileCheck) {
      return res.status(400).json({
        success: false,
        message: 'file_already_exists',
      });
    }

    await createFolder(uploadPath);
    file.mv(uploadPath, function (err) {
      if (err) {
        console.log('err', err);
        return res.status(500).send(err);
      }
      fs.chmodSync(uploadPath, '755');
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

app.delete('/delete', async function (req, res) {
  try {
    let { filePath = '' } = req.query;

    deletePath = path.resolve(__dirname, WRITE_PATH + filePath);

    const fileCheck = fs.existsSync(deletePath);
    if (!fileCheck) {
      return res.status(400).json({
        success: false,
        message: 'file_not_found',
      });
    }

    fs.access(deletePath, fs.constants.F_OK, async (err) => {
      if (err) {
        console.log('err', err);
        res.status(400).json({ success: false, message: err });
      } else {
        await fs.unlinkSync(deletePath);
        res.json({ success: true });
      }
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
