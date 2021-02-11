'use strict';

/* global $, socket, ajaxify, app */

$('document').ready(function () {

  $(window).on('action:post.tools.load', addPostHandlers);
  $(window).on('action:posts.loaded', function (_, data) {
    if (data.posts && data.posts.length) {
      markPosts(data.posts);
    }
  });
  $(window).on('action:ajaxify.end', function () {
    if (ajaxify.data.posts) {
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

    var blurInserted = $("body").has("#nsfwBlur");
    var nsfwPosts = [];

    for (var post of posts) {
      if (post.isNSFW) {
        nsfwPosts.push(post.pid);
        if (!blurInserted) {
          $("body").append('<svg width="0" height="0" style="position:absolute"><filter id="nsfwBlur"><feGaussianBlur in="SourceGraphic" stdDeviation="50"></feGaussianBlur></filter></svg>');
          blurInserted = true;
        }
        $('[component="post"][data-pid="' + post.pid + '"]').addClass('containsNSFW');
      }
    }

    if (nsfwPosts.length) {
      socket.emit('plugins.NSFWFilter.isNSFWAllowed', {}, function (err, isNSFWAllowed) {
        if (err) {
          return app.alertError(err);
        }
        if (!isNSFWAllowed.birthday) {
          displayAgreementWindow(false, false);
          return;
        }
        displayAgreementWindow(true, !isNSFWAllowed.agreement, function (err, pid) {
          if (err) {
            return app.alertError(err);
          }
          $('[data-pid="' + pid + '"].containsNSFW .afn_agreement').remove('');
          $('[data-pid="' + pid + '"].containsNSFW').removeClass('containsNSFW');
        });
      });
    }
  }

  function displayAgreementWindow(showButton, callAgreement, callback) {
    app.parseAndTranslate('plugins/filter-nsfw/agreement', { showButton: showButton }, function (html) {
      $('[component="post"].containsNSFW .content').before(html);
      if (showButton) {
        $('.afn_agreement .afn_agreement__submit').on('click', function () {
          var id = $(this).closest('[data-pid]').attr('data-pid');
          if (callAgreement) {
            socket.emit('plugins.NSFWFilter.subscribeAgreement', {}, function (err) {
              callback(err, id)
            });
          } else {
            callback(null, id);
          }
        });
      }
    });
  }
});
