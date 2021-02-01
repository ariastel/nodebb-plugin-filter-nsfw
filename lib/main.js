'use strict';

/* global $, socket, ajaxify, app */

$('document').ready(function () {

  $(window).on('action:post.tools.load', addPostHandlers);
  $(window).on('action:posts.loaded', markPosts);
	$(window).on('action:ajaxify.end', function () {
		if (ajaxify.data.template.topic && ajaxify.data.posts) {
			markPosts(ajaxify.data.posts);
		}
	});

  function addPostHandlers() {
    $('[component="nsfw-filter/mark"]').on('click', markPostAsNSFW);
  }

  function markPostAsNSFW() {
    var pid = $(this).parents('[data-pid]').attr('data-pid');

    socket.emit('plugins.NSFWFilter.toggleNSFW', { pid: pid }, function (err, isNSFW) {
      if (err) {
        return app.alertError(err);
      }

      app.alertSuccess(isNSFW ? '[[nsfw-filter:post.alert.marked]]' : '[[nsfw-filter:post.alert.unmarked]]');
      ajaxify.refresh();
    });
  }
  
  function markPosts(posts) {
    for (let post of posts) {
      if (post.isNSFW) {
        $('[component="post"][data-pid="' + post.pid + '"]').addClass('containsNSFW');
      }
    }
  }
});
