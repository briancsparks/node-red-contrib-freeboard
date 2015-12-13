
// Note: This function (the text) will get injected at the end of FreeboardModel.js (inside
// the last brace).  Therefore, that class will use this as the function for saveDashboard.

var oldSaveDashboard = this.saveDashboard;
this.saveDashboard = function(_thisref, event)
{
  var hash=window.location.hash;

  if (hash) {
    hash = "start-" + Math.floor(Math.random()*99999);
    window.location.hash = hash;
  } else {
    hash = hash.substring(1);
  }

  var body, pretty = $(event.currentTarget).data("pretty");
  if (pretty) {
    body = JSON.stringify(self.serialize(), null, "\t");
  } else {
    body = JSON.stringify(self.serialize());
  }

  var contentType = "application/octet-stream";
  var a = document.createElement("a");
  $.ajax({
    type:"POST",
    url:"../freeboard_api/dashboard",
    data:{
      content : body,
      name    : hash
    }
  }).done(function() {
    new DialogBox("Dashboard is saved, make sure to bookmark the URL.", "Info", "OK");
  });
};

