'use strict';

const meta = require.main.require('./src/meta');
const posts = require.main.require('./src/posts');
const privileges = require.main.require('./src/privileges');
const SocketPlugins = require.main.require('./src/socket.io/plugins');
const tf = require('@tensorflow/tfjs-node');
const nsfw = require('nsfwjs');
const fetch = require('node-fetch');


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

  handleSocketIO();

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

function getImagesFromPost(content) {
    const regexp = new RegExp(/!\[[^[()\]]*\]\(([^[()\]]*)\)/, "g");
    const results = [];

    let tempArr;
    while ((tempArr = regexp.exec(content)) !== null) {
      results.push(tempArr[1]);
    }

    return results;
}

async function downloadAndCheckImage(url) {
  const buffer = await fetch(url).then(res => res.buffer()).catch(() => null);
  return buffer
    ? await isNSFWImage(buffer)
    : false;
}

async function wait(time = 1e3) {
  return new Promise(res => setTimeout(res, time));
}

async function handlePostChange(post) {
  let isNSFWPost = false;

	// eslint-disable-next-line no-prototype-builtins
	if (post.hasOwnProperty('isNSFW')) {
		return;
	}

  for (const image of getImagesFromPost(post.content)) {
    const isNSFWImage = await downloadAndCheckImage(image);
    if (isNSFWImage) {
      isNSFWPost = true;
      break;
    }
    await wait();
  }
  
  if (isNSFWPost) {
    await posts.setPostField(post.pid, 'isNSFW', 1);
  }
}

async function toggleNSFW(pid) {

	let isNSFW = await posts.getPostField(pid, 'isNSFW');
  isNSFW = parseInt(isNSFW, 10) === 1;
  
	const updatedPostField = isNSFW ? 0 : 1;
  await posts.setPostField(pid, 'isNSFW', updatedPostField);
  
  return updatedPostField;
}

function handleSocketIO() {
	SocketPlugins.NSFWFilter = {};

	SocketPlugins.NSFWFilter.toggleNSFW = async function (socket, data) {
		const canToggleMark = await isCanToggleMark(data.pid, socket.uid);
		if (!canToggleMark) {
			throw new Error('[[error:no-privileges]]');
		}

		return await toggleNSFW(data.pid);
	};
}

async function isCanToggleMark(pid, uid) {
  
  const cid = await posts.getCidByPid(pid);
  const [isAdminOrMod, { flag: canEdit }] = await Promise.all([
    privileges.categories.isAdminOrMod(cid, uid),
    privileges.posts.canEdit(pid, uid)
  ]);

  return isAdminOrMod || canEdit;
}

FilterNSFWPlugin.onPostCreate = async function ({ post }) {
  await handlePostChange(post);
};

FilterNSFWPlugin.onPostEdit = async function ({ post }) {
  await handlePostChange(post);
};

FilterNSFWPlugin.addPostTool = async function (postData) {

  if (!postData.uid || !postData.pid) {
    return postData;
  }

  const canToggleMark = await isCanToggleMark(postData.pid, postData.uid);
  if (!canToggleMark) {
    return postData;
  }

	postData.isNSFW = parseInt(postData.isNSFW, 10) === 1;
  postData.tools.push({
    action: 'nsfw-filter/mark',
    html: '[[nsfw-filter:post.tool.mark]]',
    icon: 'fa-check-circle',
  });

	return postData;
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