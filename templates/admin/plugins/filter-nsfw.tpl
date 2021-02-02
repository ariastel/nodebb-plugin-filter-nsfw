<div class="row">
	<div class="col-xs-12">
		<div class="panel panel-default">
			<div class="panel-heading">Filter settings</div>
			<div class="panel-body">
				<form role="form" class="form-horizontal filter-nsfw-settings">
					<p>Enter the minumum probability to block the image uploading</p>
					<div class="form-group">
						<label for="host" class="col-sm-1 control-label">Hentai</label>
    				<div class="col-sm-3">
							<input type="number" id="hentai" name="hentai" min="0" max="100" class="form-control">
						</div>
					</div>
					<div class="form-group">
						<label for="host" class="col-sm-1 control-label">Porn</label>
    				<div class="col-sm-3">
							<input type="number" id="porn" name="porn" min="0" max="100" class="form-control">
						</div>
					</div>
					<div class="form-group">
						<label for="host" class="col-sm-1 control-label">Sexy</label>
    				<div class="col-sm-3">
							<input type="number" id="sexy" name="sexy" min="0" max="100" class="form-control">
						</div>
					</div>
				</form>
			</div>
		</div>
	</div>
</div>

<button id="save" class="floating-button mdl-button mdl-js-button mdl-button--fab mdl-js-ripple-effect mdl-button--colored">
	<i class="material-icons">save</i>
</button>