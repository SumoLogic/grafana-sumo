// ///<reference path="../../../headers/common.d.ts" />
//
// import _ from 'lodash';
// import {QueryCtrl} from 'app/plugins/sdk';
// import appEvents from 'app/core/app_events';
//
// class SumoQueryCtrl extends QueryCtrl {
//   static templateUrl = 'partials/query.editor.html';
//   suggestMetrics: any;
//   savedCallback: any;
//
//   segments: any[];
//
//   /** @ngInject */
//   constructor($scope, $injector, private uiSegmentSrv, private templateSrv) {
//     super($scope, $injector);
//
//     var target = this.target;
//     target.expr = target.expr || '';
//     target.intervalFactor = 1;
//     $scope.$on('typeahead-updated', () => {
//       this.$scope.$apply(() => {
//       });
//     });
//
//     this.segments = [this.uiSegmentSrv.newSelectMetric()];
//
//     // called from typeahead, so needed this here in order to ensure this ref
//     this.suggestMetrics = (query, callback) => {
//       var cb;
//       if (callback!==undefined){
//         this.savedCallback = callback;
//       }
//       cb = this.savedCallback;
//       this.datasource.performSuggestQuery(query)
//         .then(cb);
//     };
//   }
//
//   toggleEditorMode() {
//     this.target.textEditor = !this.target.textEditor;
//     // this.parseTarget();
//   }
//
//   getAltSegments(index) {
//     // var query = index === 0 ?  '*' : this.getSegmentPathUpTo(index) + '.*';
//     var query = "x-tokens|*";
//     return this.datasource.metricFindQuery(query).then(tokens => {
//       var altSegments = _.map(tokens, segment => {
//         return this.uiSegmentSrv.newSegment({value: segment.text, expandable: segment.expandable});
//       });
//
//       if (altSegments.length === 0) { return altSegments; }
//
//       // Add template variables
//       _.each(this.templateSrv.variables, variable => {
//         altSegments.unshift(this.uiSegmentSrv.newSegment({
//           type: 'template',
//           value: '$' + variable.name,
//           expandable: true,
//         }));
//       });
//
//       // Add wildcard option
//       altSegments.unshift(this.uiSegmentSrv.newSegment('*'));
//       return altSegments;
//
//     //   console.log(">>> getMetrics");
//     //   console.log(metrics);
//     //   return metrics;
//     }).catch(err => {
//       appEvents.emit('alert-error', ['Error', err]);
//       return [];
//     });
//   }
//
//   segmentValueChanged(segment, segmentIndex) {
//     this.error = null;
//
//     // if (this.functions.length > 0 && this.functions[0].def.fake) {
//     //   this.functions = [];
//     // }
//
//     if (segment.expandable) {
//       return this.checkOtherSegments(segmentIndex + 1).then(() => {
//         this.setSegmentFocus(segmentIndex + 1);
//         this.targetChanged();
//       });
//     } else {
//       this.segments = this.segments.splice(0, segmentIndex + 1);
//     }
//
//     this.setSegmentFocus(segmentIndex + 1);
//     this.targetChanged();
//   }
// }
//
// export {SumoQueryCtrl};
