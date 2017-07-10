///<reference path="../../../headers/common.d.ts" />

import angular from 'angular';
import _ from 'lodash';
import {QueryCtrl} from 'app/plugins/sdk';

class SumoQueryCtrl extends QueryCtrl {
  static templateUrl = 'partials/query.editor.html';

  metric: any;
  oldTarget: any;
  suggestMetrics: any;
  cursorPosition: number = -1;
  selectionEnd: number = -1;

  /** @ngInject */
  constructor($scope, $injector, private templateSrv) {
    super($scope, $injector);

    var target = this.target;
    target.expr = target.expr || '';
    target.intervalFactor = 1;

    this.metric = '';

    $scope.$on('typeahead-updated', () => {
      this.$scope.$apply(() => {

        this.target.expr += this.target.metric;
        this.metric = '';
        this.refreshMetricData();
      });
    });

    // called from typeahead so need this
    // here in order to ensure this ref
    this.suggestMetrics = (query, callback) => {
      this.datasource.performSuggestQuery(query.substring(0,this.selectionEnd)).then(callback);
    };
  }

  getCursorPos($event) {
    var myEl = $event.target;
    this.doGetCaretPosition(myEl);
  };

  doGetCaretPosition(oField) {
    var iCaretPos = 0;
    if (navigator.appName === 'Microsoft Internet Explorer') {
      oField.focus();
      var oSel = oField.createTextRange();
      oSel.moveStart('character', -oField.value.length);
      iCaretPos = oSel.text.length;
    } else if (oField.selectionStart || oField.selectionStart === '0') {
      iCaretPos = oField.selectionStart;
      this.selectionEnd = oField.selectionEnd;
    }

  this.cursorPosition = iCaretPos;
};

  refreshMetricData() {
    if (!_.isEqual(this.oldTarget, this.target)) {
      this.oldTarget = angular.copy(this.target);
      this.panelCtrl.refresh();
    }
  }
}

export {SumoQueryCtrl};
