///<reference path="../../../headers/common.d.ts" />

import angular from 'angular';
import _ from 'lodash';
import moment from 'moment';
import * as dateMath from 'app/core/utils/datemath';
import MetricFindQuery from './metric_find_query';

var durationSplitRegexp = /(\d+)(ms|s|m|h|d|w|M|y)/;

/** @ngInject */
export function SumoDatasource(instanceSettings, $q, backendSrv, templateSrv, timeSrv) {
  this.type = 'sumo';
  this.name = instanceSettings.name;
  this.supportMetrics = true;
  this.url = instanceSettings.url;
  this.directUrl = instanceSettings.directUrl;
  this.basicAuth = instanceSettings.basicAuth;
  this.withCredentials = instanceSettings.withCredentials;
  this.lastErrors = {};
  this.start;
  this.end;
  this.error = '';
  this.quantizationDefined = false;

  this._request = function(method, url, data) {
    var options: any = {
      url: this.url + url,
      method: method,
      data: data,
    };

    if (this.basicAuth || this.withCredentials) {
      options.withCredentials = true;
    }
    if (this.basicAuth) {
      options.headers = {
        "Content-Type": "application/json",
        "Authorization": this.basicAuth,
      };
    }

    return backendSrv.datasourceRequest(options);
  };

  function specialRegexEscape(value) {
    return value.replace(/[\\^$*+?.()|[\]{}]/g, '\\\\$&');
  }

  this.interpolateQueryExpr = function(value, variable, defaultFormatFn) {
    // if no multi or include all do not regexEscape. Is this needed?
    if (!variable.multi && !variable.includeAll) {
      return value;
    }

    if (typeof value === 'string') {
      return specialRegexEscape(value);
    }

    var escapedValues = _.map(value, specialRegexEscape);
    return escapedValues.join('|');
  };

  this.targetContainsTemplate = function(target) {
    return templateSrv.variableExists(target.expr);
  };

  // Called once per panel (graph)
  this.query = function(options) {
    var self = this;
    this.start = this.getTime(options.range.from, false);
    this.end = this.getTime(options.range.to, true);
    var maxDataPoints = options.maxDataPoints;
    this.desiredQuantization = this.calculateInterval(options.interval);
    var queries = [];
    var activeTargets = [];

    options = _.clone(options);

    _.each(options.targets, target => {
      if (!target.expr || target.hide) {
        return;
      }

      activeTargets.push(target);

      var query: any = {};
      query.expr = templateSrv.replace(target.expr, options.scopedVars, self.interpolateQueryExpr);
      query.requestId = options.panelId + target.refId;
      queries.push(query);
    });

    // No valid targets, return the empty result to save a round trip.
    if (_.isEmpty(queries)) {
      var d = $q.defer();
      d.resolve({ data: [] });
      return d.promise;
    }

    var allQueryPromise = [this.performTimeSeriesQuery(queries, this.start, this.end, maxDataPoints, this.desiredQuantization)];

    return $q.all(allQueryPromise).then(function(allResponse) {
      var result = [];
      _.each(allResponse, function(response, index) {
        if (response.status === 'error') {
          self.lastErrors.query = response.error;
          throw response.error;
        } else {
          result = self.transformMetricData(response.data.response);
        }
        delete self.lastErrors.query;
        result = self.transformMetricData(response.data.response);
      });

      return { data: result };
    });
  };

  this.performTimeSeriesQuery = function(queries, start, end, maxDataPoints, desiredQuantization) {
    if (start > end) {
      throw { message: 'Invalid time range' };
    }
    var queryList = [];
    for (var i = 0; i<queries.length; i++){
      queryList.push({
          'query': queries[i].expr,
          'rowId': queries[i].requestId,
      });
    }
    var url = '/api/v1/metrics/results';
    var data = {
      'query': queryList,
      'startTime': start,
      'endTime': end,
      "maxDataPoints": maxDataPoints,
    };
    if (this.quantizationDefined && desiredQuantization){
      data['desiredQuantizationInSecs'] = desiredQuantization;
    }
    return this._request('POST', url, data);
  };

  this.performSuggestQuery = function(query) {
    var url = '/api/v1/metrics/suggest/autocomplete';
    var data = {
      query: query,
      pos: query.length,
      queryStartTime: this.start,
      queryEndTime: this.end
    };
    return this._request('POST', url, data).then(function(result) {
      var suggestionsList = [];
      _.each(result.data.suggestions, function(suggestion){
        _.each(suggestion.items, function(item){
            suggestionsList.push(item.replacement.text);
        });
      });
      return suggestionsList;
    });
  };

  this.metricFindQuery = function(query) {
    if (!query) { return $q.when([]); }

    var interpolated;
    try {
      interpolated = templateSrv.replace(query, {}, this.interpolateQueryExpr);
    } catch (err) {
      return $q.reject(err);
    }

    var metricFindQuery = new MetricFindQuery(this, interpolated, timeSrv);
    return metricFindQuery.process();
  };

  this.testDatasource = function() {
    return this.metricFindQuery('metrics(.*)').then(function() {
      return { status: 'success', message: 'Data source is working', title: 'Success' };
    });
  };

  this.calculateInterval = function(interval) {
    var m = interval.match(durationSplitRegexp);
    var dur = moment.duration(parseInt(m[1]), m[2]);
    var sec = dur.asSeconds();
    if (sec < 1) {
      sec = 1;
    }
    return Math.ceil(sec);
  };

  this.transformMetricData = function(responses) {

    var seriesList = [];
    var warning;

    for (var i = 0; i < responses.length; i++) {
      var response = responses[i];

      if (!response.messageType) {
        for (var j = 0; j < response.results.length; j++) {
          var result = response.results[j];

          // Synthesize the "target" - the "metric name" basically.
          var target = "";
          var dimensions = result.metric.dimensions;
          for (var k = 0; k < dimensions.length; k++) {
            var dimension = dimensions[k];
            target += dimension.key + "=" + dimension.value;
            if (k !== dimensions.length - 1) {
              target += ",";
            }
          }

          // Create Grafana-suitable datapoints.
          var values = result.datapoints.value;
          var timestamps = result.datapoints.timestamp;
          var length = Math.min(values.length, timestamps.length);
          var datapoints = [];
          for (var l = 0; l < length; l++) {
            var value = values[l];
            var valueParsed = parseFloat(value);
            var timestamp = timestamps[l];
            var timestampParsed = parseFloat(timestamp);
            datapoints.push([valueParsed, timestampParsed]);
          }

          // Add the series.
          seriesList.push({target: target, datapoints: datapoints});
        }
      } else {
          warning = "Warning: " + response.message;
      }
    }
    if (warning) {
      this.error = warning;
    }

    return seriesList;
  };

  this.renderTemplate = function(aliasPattern, aliasData) {
    var aliasRegex = /\{\{\s*(.+?)\s*\}\}/g;
    return aliasPattern.replace(aliasRegex, function(match, g1) {
      if (aliasData[g1]) {
        return aliasData[g1];
      }
      return g1;
    });
  };

  this.getOriginalMetricName = function(labelData) {
    var metricName = labelData.__name__ || '';
    delete labelData.__name__;
    var labelPart = _.map(_.toPairs(labelData), function(label) {
      return label[0] + '="' + label[1] + '"';
    }).join(',');
    return metricName + '{' + labelPart + '}';
  };

  this.getTime = function(date, roundUp) {
    if (_.isString(date)) {
      date = dateMath.parse(date, roundUp);
    }
    return Math.ceil(date.valueOf());
  };

  this.changeQuantization = function() {
    this.quantizationDefined = true;
  };

  this.clearError = function() {
    this.error = "";
  };
}
