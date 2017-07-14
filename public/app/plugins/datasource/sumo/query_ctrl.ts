///<reference path="../../../headers/common.d.ts" />

import {QueryCtrl} from 'app/plugins/sdk';

class SumoQueryCtrl extends QueryCtrl {
  static templateUrl = 'partials/query.editor.html';
  suggestMetrics: any;
  savedCallback: any;

  /** @ngInject */
  constructor($scope, $injector, private templateSrv) {
    super($scope, $injector);

    var target = this.target;
    target.expr = target.expr || '';
    target.intervalFactor = 1;
    $scope.$on('typeahead-updated', () => {
      this.$scope.$apply(() => {
      });
    });

    // called from typeahead, so needed this here in order to ensure this ref
    this.suggestMetrics = (query, callback) => {
      var cb;
      if (callback!==undefined){
        this.savedCallback = callback;
      }
      cb = this.savedCallback;
      this.datasource.performSuggestQuery(query)
        .then(cb);
    };
  }
}

export {SumoQueryCtrl};
