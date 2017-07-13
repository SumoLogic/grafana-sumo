import {SumoDatasource} from './datasource';
import {SumoQueryCtrl} from './query_ctrl';

class SumoConfigCtrl {
  static templateUrl = 'partials/config.html';
}

class SumoQueryOptionsCtrl {
  static templateUrl = 'partials/query.options.html';
}

export {
  SumoDatasource as Datasource,
  SumoQueryCtrl as QueryCtrl,
  SumoConfigCtrl as ConfigCtrl,
  SumoQueryOptionsCtrl as QueryOptionsCtrl,
};
