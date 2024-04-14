const fs = require('fs');

const createHtmlInImg = (src, title) => {
  // eslint-disable-next-line max-len
  return `<html style="height: 100%;"><head><meta name="viewport" content="width=device-width, minimum-scale=0.1"><title>${title}</title></head><body style="margin: 0px; height: 100%; background-color: rgb(14, 14, 14);"><img style="display: block;-webkit-user-select: none;margin: auto;cursor: zoom-in;background-color: hsl(0, 0%, 90%);transition: background-color 300ms;" src="${src}" width="864" height="485"></body></html>`;
};

const createFolder = (path) => {
  return new Promise((resolve) => {
    const pathArr = path.replaceAll('\\', '/').split('/');

    let strPath = ``;
    for (let index = 1; index < pathArr.length - 1; index++) {
      const pathStr = pathArr[index];

      strPath += `/${pathStr}`;

      if (!fs.existsSync(strPath)) {
        fs.mkdirSync(strPath);
      }
    }

    resolve(true);
  });
};

module.exports = {
  createHtmlInImg,
  createFolder,
};
