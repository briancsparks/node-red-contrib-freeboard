$(function() {

  freeboard.initialize(true);
  var hash = window.location.hash;

  if (hash !== null) {
    $.get("/freeboard_api/dashboard/"+hash.substring(1), function(data) {
      var datap;

      try {
        datap = JSON.parse(data);
        if (datap) {
          freeboard.loadDashboard(datap, function() {
            freeboard.setEditing(false);
          });
        }
      } catch(ex) {}
    });
  }

});

