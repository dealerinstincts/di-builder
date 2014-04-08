/**
 * actions.js
 * The main JavaScript which mainly does the dynamic actions.
 * 
 * @author  Jason Valdron <jason@dealerinstincts.com>
 * @package di-builder
 */
(function(){

  var refreshActionsInterval = 2 * 1000, // 2s
      refreshDataInterval = 5 * 1000; // 2s

  $(document).ready(function(){

    $('#actions').parents('.col-xs-12').hide();

    // Function to refresh the actions list.
    var refreshActions = function(){

      // Just get the JSON content of /actions.
      $.getJSON('/actions', function(actions){
        
        // Remove existing actions.
        $('#actions').empty();

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
          $('#actions').append(action);

        });

        // Now show/hide our actions.
        $('#actions').parents('.col-xs-12')[actions && actions.length ? 'show' : 'hide']();

        $('#actions-loading').removeClass('loading');

      });

    };

    // Function to refresh the data list.
    var refreshData = function(){

      // Just get the JSON content of /data.
      $.getJSON('/data', function(data){
        
        // Remove existing stacks and builds.
        $('#stacks, #builds tbody, #deployments tbody').empty();

        // Create elements for all of our sections.
        $.each(data.stacks, function(){

          // Create an element for our action.
          var stack = $('<a />', {
            class: 'list-group-item',
            href: this.deployments && this.deployments.length ? 'deployment/' + this.deployments[0].DeploymentId + '/log' : '',
            target: '_blank'
          }).text(this.name + ' ');

          // Add the color.
          stack.prepend($('<span class="color-block" />').css('background-color', this.color));

          // Add the branch.
          stack.append($('<span class="text-info" />').text('(' + this.branch + ')'));

          // Add the status of the last deployment.
          if (this.deployments && this.deployments.length) {
            if (this.deployments[0].Status === 'running') {
              stack.append('<span class="fa fa-icon-only fa-fw fa-spinner fa-spin pull-right" />');
            } else {
              var successful = this.deployments[0].Status === 'successful';
              stack.append(
                $('<span class="label pull-right ' + (successful ? 'label-success' : 'label-danger') + '" />').text(successful ? 'Success' : 'Error').prepend(
                  $('<span class="fa fa-icon-only fa-fw ' + (successful ? 'fa-check' : 'fa-times') + '" />')
                )
              );
            }
          }

          // Finally, add the element to the stacks list.
          $('#stacks').append(stack);

        });

        // Now show/hide our builds.
        $('#stacks')[data.stacks && data.stacks.length ? 'show' : 'hide']();
        $('#stacks').next('.empty')[data.stacks && data.stacks.length ? 'hide' : 'show']();

        // Create elements for all of our sections.
        $.each(data.deployments, function(){

          // Create an element for our action.
          var deployment = $('<tr />');

          // Add all the fields.
          deployment.append($('<td />').text(this.stacks ? this.stacks.join(', ') : 'None'))
               .append($('<td />').text(this.branch))
               .append($('<td class="text-center" />').append($('<span class="fa fa-icon-only fa-fw fa-' + (this['build-mobile'] ? 'check' : 'times') + '" />')))
               .append($('<td />').text(this.dateTime))
               .append($('<td class="text-center" />').append($('<a />', {
                 href: 'deployment/' + this.id + '/delete'
               }).append('<span class="fa fa-icon-only fa-fw fa-times text-danger"></span>').on('click', function(e){
                 e.preventDefault();
                $('#deployments-loading').addClass('loading');
                $.post('/' + $(this).attr('href'), refreshData);
               })));

          // Finally, add the element to the deployments list.
          $('#deployments').append(deployment);

        });

        // Now show/hide our deployments.
        $('#deployments')[data.deployments && data.deployments.length ? 'show' : 'hide']();
        $('#deployments-loading .empty')[data.deployments && data.deployments.length ? 'hide' : 'show']();

        // Create elements for all of our sections.
        $.each(data.builds, function(){

          // Create an element for our action.
          var build = $('<tr />');

          // Add all the fields.
          build.append($('<td />').text(this.name))
               .append($('<td />').text(this.branch))
               .append($('<td class="text-center" />').text(this.versionCode))
               .append($('<td />').text(this.dateTime))
               .append($('<td class="text-center" />').append($('<a />', {
                 href: 'mobile/build/' + this.filename
               }).append('<span class="fa fa-icon-only fa-fw fa-android text-success"></span>')));

          // Finally, add the element to the builds list.
          $('#builds').append(build);

        });

        // Now show/hide our builds.
        $('#builds')[data.builds && data.builds.length ? 'show' : 'hide']();
        $('#builds').next('.empty')[data.builds && data.builds.length ? 'hide' : 'show']();

        $('[id$=-loading]').removeClass('loading');

      });

    };

    // Refresh the actions and data every x milliseconds.
    setInterval(refreshActions, refreshActionsInterval);
    setInterval(refreshData, refreshDataInterval);

    // Let's get the initial actions and data.
    refreshActions();
    refreshData();

    // Force refresh data.
    $('#force-refresh').on('click', function(e){
      e.preventDefault();
      $('[id$=-loading]').addClass('loading');
      refreshData();
    });

    // Build now with AJAX.
    $('#build-now').on('click', function(e){
      e.preventDefault();
      $('#actions-loading').addClass('loading');
      $.post('/mobile/build', refreshActions);
    });

    // Clear completed actions.
    $('#clear-actions').on('click', function(e){
      e.preventDefault();
      $('#actions-loading').addClass('loading');
      $.post('/actions/clear', refreshActions);
    });

  });

})();