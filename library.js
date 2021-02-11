'use strict';

const meta = require.main.require('./src/meta');
const posts = require.main.require('./src/posts');
const privileges = require.main.require('./src/privileges');
const SocketPlugins = require.main.require('./src/socket.io/plugins');
const user = require.main.require('./src/user');

const tf = require('@tensorflow/tfjs-node');
const nsfw = require('nsfwjs');
const fetch = require('node-fetch');


const FilterNSFWPlugin = {
  settings: null,
  model: null
};

// #region Plugin
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

FilterNSFWPlugin.onPostCreate = async function ({ post }) {
  await handlePostChange(post);
};

FilterNSFWPlugin.onPostEdit = async function ({ post }) {
  await handlePostChange(post);
};

FilterNSFWPlugin.onUserFieldChange = async function ({ uid, field }) {
  if (field === 'birthday') {
    await user.setUserField(uid, 'nsfwAgreement', 0);
  }
};

FilterNSFWPlugin.addPostTool = async function (postData) {

  if (!postData.uid || !postData.pid) {
    return postData;
  }

  const canToggleMark = await isCanToggleMark(postData.pid, postData.uid);
  if (!canToggleMark) {
    return postData;
  }

  const containsNSFW = await isPostHasNSFWMark(postData.pid);
  postData.tools.push({
    action: 'filter-nsfw/mark',
    html: containsNSFW ? '[[filter-nsfw:post.tool.unmark]]' : '[[filter-nsfw:post.tool.mark]]',
    icon: containsNSFW ? 'fa-circle' : 'fa-check-circle',
  });

  return postData;
};

FilterNSFWPlugin.addNSFWFlag = async function (postData) {

  const postsMarks = await posts.getPostsFields(postData.posts.map(post => post.pid), ['pid', 'isNSFW']);
  if (!postsMarks) {
    return postData;
  }

  const marks = {};
  for (const post of postsMarks) {
    marks[post.pid] = post.isNSFW;
  }

  for (const post of postData.posts) {
    post.isNSFW = marks[post.pid] || 0;
  }

  return postData;
}
// #endregion Plugin

// #region SocketPlugin


function handleSocketIO() {
  SocketPlugins.NSFWFilter = {};

  SocketPlugins.NSFWFilter.toggleNSFW = async function (socket, data) {

    const canToggleMark = await isCanToggleMark(data.pid, socket.uid);
    if (!canToggleMark) {
      throw new Error('[[error:no-privileges]]');
    }

    return await toggleNSFW(data.pid);
  };

  SocketPlugins.NSFWFilter.isNSFWAllowed = async function (socket) {
    return await isNSFWAllowed(socket.uid);
  };

  SocketPlugins.NSFWFilter.subscribeAgreement = async function (socket) {
    return await setAgreementMark(socket.uid);
  };
}
//#endregion Socket Plugin

module.exports = FilterNSFWPlugin;


// #region Functions
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

async function isPostHasNSFWMark(pid) {
  let isNSFW = await posts.getPostField(pid, 'isNSFW');
  return parseInt(isNSFW, 10) === 1;
}

async function toggleNSFW(pid) {

  const updatedPostField = await isPostHasNSFWMark(pid) ? 0 : 1;
  await posts.setPostField(pid, 'isNSFW', updatedPostField);

  return updatedPostField;
}

async function isCanToggleMark(pid, uid) {

  const cid = await posts.getCidByPid(pid);
  const [isAdminOrMod = false, { flag: canEdit } = { flag: false }] = await Promise.all([
    privileges.categories.isAdminOrMod(cid, uid),
    privileges.posts.canEdit(pid, uid)
  ]);

  return isAdminOrMod || canEdit;
}

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

async function setAgreementMark(uid) {
  return uid
    ? await user.setUserField(uid, 'nsfwAgreement', 1)
    : null;
}

async function isNSFWAllowed(uid) {

  if (!uid) {
    return { birthday: false, agreement: false };
  }

  const userData = await user.getUserFields(uid, ['birthday', 'nsfwAgreement']);
  if (!userData || !userData.birthday) {
    return { birthday: false, agreement: false };
  }

  const ageDifMs = Date.now() - new Date(userData.birthday).getTime();
  const ageDate = new Date(ageDifMs);

  return {
    birthday: Math.abs(ageDate.getUTCFullYear() - 1970) > 18,
    agreement: userData.nsfwAgreement === 1
  }
}
// #endregion Functions