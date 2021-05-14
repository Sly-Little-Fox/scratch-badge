const {
  createCanvas,
  loadImage,
  // eslint-disable-next-line no-unused-vars
  CanvasRenderingContext2D,
  // eslint-disable-next-line no-unused-vars
  Canvas
} = require('canvas');
const url = require('url-parse');
const fetch = require('node-fetch');
const path = require('path');
const express = require('express');
const app = express();
const mcache = require('memory-cache');

app.set('x-powered-by', false);

app.get('/favicon.ico', (req, res) => {
  res.setHeader('X-Bruh', 'Are you trying to get a user with username \'favicon.ico\' or what?');
  res.sendFile(path.resolve('assets/favicon.ico'));
});

app.get('/:username', (req, res) => {
  let {
    username
  } = req.params;
  let cachedImage = mcache.get(username);
  if (cachedImage) {
    res.setHeader('Cache-Control', 'max-age=0, no-cache, public, stale-while-revalidate=40');
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', cachedImage.byteLength || 0);
    res.send(cachedImage);
    return;
  }
  try {
    fetch(`https://api.scratch.mit.edu/users/${encodeURIComponent(username)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ScratchBadge/1.0)'
      }
    }).then(r => {
      if (r.ok) {
        try {
          let canvas = createCanvas(450, 150);
          let ctx = canvas.getContext('2d');
          fetch(`https://scratch.mit.edu/site-api/users/all/${encodeURIComponent(username)}`, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; ScratchBadge/1.0)'
            }
          }).then(r => {
            if (r.ok) {
              let n = 0;
              let projectCount = 0;
              let starCount = 0;
              let loveCount = 0;
              let execute = () => {
                fetch(`https://api.scratch.mit.edu/users/${encodeURIComponent(username)}/projects?offset=${n * 20}`, {
                  headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; ScratchBadge/1.0)'
                  }
                }).then(r => r.json()).then(projects => {
                  if (r.ok) {
                    projectCount += projects.length;
                    projects.forEach(project => {
                      loveCount += project.stats.loves;
                      starCount += project.stats.favorites;
                    });
                    if (projects.length < 20) {
                      generateBadge(r, ctx, canvas, res, projectCount, loveCount, starCount, username);
                    } else {
                      n++;
                      setImmediate(execute);
                    }
                  } else if (r.status === 404) {
                    res.status(404);
                    return res.sendFile(path.resolve('assets/Not-found.png'));
                  } else {
                    return res.sendFile(path.resolve('assets/Error.png'));
                  }
                });
              }
              execute();
            } else if (r.status === 404) {
              res.status(404);
              return res.sendFile(path.resolve('assets/Not-found.png'));
            } else {
              return res.sendFile(path.resolve('assets/Error.png'));
            }
          });
        } catch (e) {
          res.send(e);
        }
      } else if (r.status === 404) {
        res.status(404);
        return res.sendFile(path.resolve('assets/Not-found.png'));
      } else {
        return res.sendFile(path.resolve('assets/Error.png'));
      }
    });
  } catch (e) {
    res.send(e);
  }
});

/**
 * 
 * @param {fetch.Response} r 
 * @param {CanvasRenderingContext2D} ctx 
 * @param {Canvas} canvas 
 * @param {express.Response} res 
 * @param {Number} followerCount ,
 * @param {String} username
 */

function generateBadge(r, ctx, canvas, res, projectCount, loveCount, starCount, username) {
  r.json().then((userInfo) => {
    let featuredProjectThumbnail;
    if (userInfo['featured_project_data'] && userInfo['featured_project_data']['thumbnail_url']) {
      featuredProjectThumbnail = new url(userInfo['featured_project_data']['thumbnail_url']);
      featuredProjectThumbnail.set('protocol', 'https');
    } else {
      featuredProjectThumbnail = 'assets/default-background.png';
    }
    loadImage(featuredProjectThumbnail.toString()).then((projectImage) => {
      ctx.globalCompositeOperation = 'destination-over';
      scaleToFill(projectImage, ctx, canvas);
      ctx.globalCompositeOperation = 'source-over';
      let gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
      gradient.addColorStop(0, 'rgb(0, 0, 0)');
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (userInfo === null) {
        res.status(404);
        return res.sendFile(path.resolve('assets/Not-found.png'));
      }
      let userAvatar = new url(userInfo['thumbnail_url']);
      userAvatar.set('protocol', 'https');
      loadImage(userAvatar.toString()).then((avatar) => {
        scaleToFit(avatar, ctx, canvas);
        ctx.fillStyle = '#1f1f1f';
        ctx.globalCompositeOperation = 'source-over';
        fillRoundedRect(canvas.width / 2 - 30, canvas.height / 2 - 57.5, 200, 115, 10, ctx);
        ctx.fillStyle = '#fdfdfd';
        // Start text
        ctx.font = '20px sans-serif';
        ctx.fillText(username, (canvas.width / 2 + 67) - ctx.measureText(username).width / 2, (canvas.height / 2) - 30);
        ctx.font = '15px sans-serif';
        ctx.fillText(`${loveCount} loves`, canvas.width / 2 + 14, (canvas.height / 2) - 9 + 5);
        ctx.fillText(`${starCount} stars`, canvas.width / 2 + 14, (canvas.height / 2) + 13 + 5);
        ctx.fillText(`${projectCount} projects`, canvas.width / 2 + 14, (canvas.height / 2) + 35 + 5);
        // End text
        loadImage('assets/icons.png').then((icons) => {
          ctx.drawImage(icons, canvas.width / 2 - 17, canvas.height / 2 - 22 + 5, 22, 58);
          let imageData = canvas.toBuffer();
          res.setHeader('Cache-Control', 'max-age=0, no-cache, public, stale-while-revalidate=40');
          res.setHeader('Content-Type', 'image/png');
          res.setHeader('Content-Length', imageData.byteLength);
          res.writeHead(200, 'OK');
          mcache.put(username, imageData, 10 * 60 * 1000);
          res.end(imageData);
        });
      });
    });
  });
}

function scaleToFill(img, ctx, canvas) {
  // get the scale
  var scale = Math.max(canvas.width / img.width, canvas.height / img.height);
  // get the top left position of the image
  var x = (canvas.width / 2) - (img.width / 2) * scale;
  var y = (canvas.height / 2) - (img.height / 2) * scale;
  ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
}

function scaleToFit(img, ctx, canvas) {
  // get the scale
  var scale = Math.min(canvas.width / img.width, canvas.height / img.height);
  // get the top left position of the image
  var x = 0;
  var y = (canvas.height / 2) - (img.height / 2) * scale;
  ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
}

function fillRoundedRect(x, y, w, h, r, ctx) {
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
}

app.listen(2021, () => {
  console.log('Listening!!!');
});