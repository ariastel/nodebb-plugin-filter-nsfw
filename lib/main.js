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

    var nsfwPosts = [];

    for (var post of posts) {
      if (parseInt(post.isNSFW)) {
        nsfwPosts.push(post.pid);
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
        if (window.sessionStorage.getItem('nodebb-plugin-filter-nsfw/session')) {
          removeFilters();
          return;
        }
        displayAgreementWindow(true, !isNSFWAllowed.agreement, function (err) {
          if (err) {
            return app.alertError(err);
          }
          window.sessionStorage.setItem('nodebb-plugin-filter-nsfw/session', true);
          removeFilters();
        });
      });
    }
  }

  function displayAgreementWindow(showButton, callAgreement, callback) {
    app.parseAndTranslate('plugins/filter-nsfw/agreement', { showButton: showButton }, function (html) {
      $('[component="post"].containsNSFW:not(.containsNSFWAgreement) .content').before(html);
      $('[component="post"].containsNSFW').addClass('containsNSFWAgreement');
      if (showButton) {
        $('.afn_agreement .afn_agreement__submit').on('click', function () {
          if (callAgreement) {
            socket.emit('plugins.NSFWFilter.subscribeAgreement', {}, function (err) {
              callback(err)
            });
          } else {
            callback(null);
          }
        });
      }
    });
  }

  function removeFilters() {
    $('.containsNSFW .afn_agreement').remove('');
    $('.containsNSFW').removeClass('containsNSFW');
  }
});
