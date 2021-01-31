'use strict';
/* globals $, app, socket, define */

define('admin/plugins/filter-nsfw', ['settings'], function(Settings) {

	var ACP = {};

	ACP.init = function() {
		Settings.load('filter-nsfw', $('.filter-nsfw-settings'));

		$('#save').on('click', function() {
			Settings.save('filter-nsfw', $('.filter-nsfw-settings'), function() {
				app.alert({
					type: 'success',
					alert_id: 'filter-nsfw-saved',
					title: 'Settings Saved',
					message: 'Please rebuild and restart your NodeBB to apply these settings, or click on this alert to do so.',
					clickfn: function() {
						socket.emit('admin.reload');
					}
				});
			});
		});
	};

	return ACP;
});