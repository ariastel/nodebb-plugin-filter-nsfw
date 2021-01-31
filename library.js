'use strict';

const sharp = require.main.require('sharp');
const meta = require.main.require('./src/meta');
const fs = require('fs');
const tf = require('@tensorflow/tfjs-node');
const nsfw = require('nsfwjs');


const FilterNSFWPlugin = {
  settings: null,
  model: null
};

FilterNSFWPlugin.init = function (data, callback) {
  function render(_, res) {
    res.render('admin/plugins/filter-nsfw', {});
  }

  data.router.get('/admin/plugins/filter-nsfw', data.middleware.admin.buildHeader, render);
  data.router.get('/api/admin/plugins/filter-nsfw', render);

  meta.settings.get('filter-nsfw', async function (_, settings) {
    FilterNSFWPlugin.settings = settings;
    FilterNSFWPlugin.model = await nsfw.load();
    callback();
  });
}

FilterNSFWPlugin.addAdminNavigation = function (custom_header, callback) {
  custom_header.plugins.push({
    'route': '/plugins/filter-nsfw',
    "name": 'Filter NSFW'
  });
  callback(null, custom_header);
};

FilterNSFWPlugin.filterImage = async function (imageData) {
  const image = imageData.image;

  if (!image) {
    throw new Error("Invalid image");
  }

  const path = image.url ? image.url : image.path;
  if (!path) {
    throw new Error("Invalid image path");
  }

  const buffer = await fs.promises.readFile(path);
  if (isNSFWImage(buffer)) {
    const blurSize = Number(FilterNSFWPlugin.settings.blur) || 10;
    await sharp(buffer).blur(blurSize).toFile(path);
  }

  return imageData;
};

async function isNSFWImage(buffer) {

  const img = await tf.node.decodeImage(buffer, 3);
  const predictions = await FilterNSFWPlugin.model.classify(img);
  img.dispose();

  for (const prediction of predictions) {
    const name = prediction.className.toLowerCase();
    if (name in FilterNSFWPlugin.settings && prediction.probability * 100 >= FilterNSFWPlugin.settings[name]) {
      return true;
    }
  }

  return false;
}

module.exports = FilterNSFWPlugin;