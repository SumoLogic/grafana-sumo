import {PrometheusDatasource} from './datasource';
import {PrometheusQueryCtrl} from './query_ctrl';

class PrometheusConfigCtrl {
  static templateUrl = 'partials/config.html';
}


export {
  PrometheusDatasource as Datasource,
  PrometheusQueryCtrl as QueryCtrl,
  PrometheusConfigCtrl as ConfigCtrl,
};
