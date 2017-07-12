///<reference path="../../../headers/common.d.ts" />

import angular from 'angular';
import _ from 'lodash';
import {QueryCtrl} from 'app/plugins/sdk';

class SumoQueryCtrl extends QueryCtrl {
  static templateUrl = 'partials/query.editor.html';
  oldTarget: any;
  metric: any;
  suggestMetrics: any;

  /** @ngInject */
  constructor($scope, $injector, private templateSrv) {
    super($scope, $injector);

    var target = this.target;
    target.expr = target.expr || '';
    target.intervalFactor = 1;
    $scope.$on('typeahead-updated', () => {
      this.$scope.$apply(() => {

        //this.target.expr += this.target.metric;
        this.refreshMetricData();
      });
    });

    // called from typeahead so need this
    // here in order to ensure this ref
    this.suggestMetrics = (query, callback) => {
      this.datasource.performSuggestQuery(query)
        .then(callback);
    };
  }

  refreshMetricData() {
    if (!_.isEqual(this.oldTarget, this.target)) {
      this.oldTarget = angular.copy(this.target);
      this.panelCtrl.refresh();
    }
  }
}

export {SumoQueryCtrl};
