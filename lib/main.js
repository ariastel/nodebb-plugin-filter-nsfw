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
    $('[component="filter-nsfw/mark"]').on('click', markPostAsNSFW);
  }

  function markPostAsNSFW() {
    var pid = $(this).parents('[data-pid]').attr('data-pid');

    socket.emit('plugins.NSFWFilter.toggleNSFW', { pid: pid }, function (err, isNSFW) {
      if (err) {
        return app.alertError(err);
      }

      app.alertSuccess(isNSFW ? '[[filter-nsfw:post.alert.marked]]' : '[[filter-nsfw:post.alert.unmarked]]');
      ajaxify.refresh();
    });
  }
  
  function markPosts(posts) {
    var blurInserted = false;
    for (var post of posts) {
      if (post.isNSFW) {
        if (!blurInserted) {
          $("body").append('<svg width="0" height="0" style="position:absolute"><filter id="nsfwBlur"><feGaussianBlur in="SourceGraphic" stdDeviation="20"></feGaussianBlur></filter></svg>');
          blurInserted = true;
        }
        $('[component="post"][data-pid="' + post.pid + '"]').addClass('containsNSFW');
      }
    }
    socket.emit('plugins.NSFWFilter.isNSFWAllowed', {}, function (err, isNSFWAllowed) {
      if (err) {
        return app.alertError(err);
      }
      if (!isNSFWAllowed.birthday) {
        displayAgreementWindow(false);
        return;
      }
      if (!isNSFWAllowed.agreement) {
        displayAgreementWindow(true, function(err) {
          if (err) {
            return app.alertError(err);
          }
          ajaxify.refresh();
        });
        return;
      }
      $('[component="post"].containsNSFW').removeClass('containsNSFW');
    });
  }
  
  function displayAgreementWindow(showButton, callback) {
    app.parseAndTranslate('plugins/filter-nsfw/agreement', { showButton: showButton }, function (html) {
      $('[component="post"].containsNSFW .content').after(html);
      if (showButton) {
        $('.agreement .agreement__submit').on('click', function() {
          socket.emit('plugins.NSFWFilter.subscribeAgreement', {}, callback);
        });
      }
    });
  }
});
