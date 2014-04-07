/**
 * actions.js
 * The main JavaScript which mainly does the dynamic actions.
 * 
 * @author  Jason Valdron <jason@dealerinstincts.com>
 * @package di-builder
 */
(function(){

  var refreshInterval = 2 * 1000; // 2s

  $(document).ready(function(){

    $('#actions').hide();

    // Function to refresh the actions list.
    var refreshActions = function(){

      // Just get the JSON content of /actions.
      $.getJSON('/actions', function(actions){
        
        // Remove existing actions.
        $('#actions .list-group').empty();

        // Create elements for all of our sections.
        $.each(actions, function(){

          // Create an element for our action.
          var action = $('<li />', {
            class: 'list-group-item'
          }).text(this.action);

          // Add our spinner or our status label.
          if (this.status === 'completed') {
            action.append($('<span class="label label-success pull-right" />').text('Success').prepend('<span class="fa fa-icon-only fa-fw fa-check" /> '));
          } else if (this.status === 'error') {
            action.append($('<span class="label label-danger pull-right" />').text('Error').prepend('<span class="fa fa-icon-only fa-fw fa-times" /> '));
          } else {
            action.prepend('<span class="fa fa-icon-only fa-fw fa-spinner fa-spin" /> ');
          }

          // Add the action description.
          if (this.description) action.append($('<small />').text(this.description));

          // Finally, add the element to the actions list.
          $('#actions .list-group').append(action);

        });

        // Now show/hide our actions.
        $('#actions')[actions && actions.length ? 'show' : 'hide']();

      });

    };

    // Refresh the actions every x milliseconds.
    setInterval(refreshActions, refreshInterval);

    // Let's get the initial actions.
    refreshActions();

  });

})();