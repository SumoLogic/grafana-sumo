///<reference path="../../../headers/common.d.ts" />

import angular from 'angular';
import _ from 'lodash';
import moment from 'moment';

import * as dateMath from 'app/core/utils/datemath';
import PrometheusMetricFindQuery from './metric_find_query';

var durationSplitRegexp = /(\d+)(ms|s|m|h|d|w|M|y)/;

/** @ngInject */
export function PrometheusDatasource(instanceSettings, $q, backendSrv, templateSrv, timeSrv) {
  this.type = 'prometheus';
  //this.editorSrc = 'app/features/prometheus/partials/query.editor.html';
  this.name = instanceSettings.name;
  this.supportMetrics = true;
  this.url = instanceSettings.url;
  this.directUrl = instanceSettings.directUrl;
  this.basicAuth = instanceSettings.basicAuth;
  this.withCredentials = instanceSettings.withCredentials;
  this.lastErrors = {};

  // Done
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

  function prometheusSpecialRegexEscape(value) {
    return value.replace(/[\\^$*+?.()|[\]{}]/g, '\\\\$&');
  }

  this.interpolateQueryExpr = function(value, variable, defaultFormatFn) {
    // if no multi or include all do not regexEscape
    if (!variable.multi && !variable.includeAll) {
      return value;
    }

    if (typeof value === 'string') {
      return prometheusSpecialRegexEscape(value);
    }

    var escapedValues = _.map(value, prometheusSpecialRegexEscape);
    return escapedValues.join('|');
  };

  this.targetContainsTemplate = function(target) {
    return templateSrv.variableExists(target.expr);
  };

  // Called once per panel (graph)
  this.query = function(options) {
    var self = this;
    var start = this.getTime(options.range.from, false)*1000;
    var end = this.getTime(options.range.to, true)*1000;
    var maxDataPoints = options.maxDataPoints;
    var minDesiredQuantization = Infinity;
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

      var interval = templateSrv.replace(target.interval, options.scopedVars) || options.interval;
      interval = this.calculateInterval(interval);
      minDesiredQuantization = minDesiredQuantization > interval? interval: minDesiredQuantization;
      queries.push(query);
    });

    // No valid targets, return the empty result to save a round trip.
    if (_.isEmpty(queries)) {
      var d = $q.defer();
      d.resolve({ data: [] });
      return d.promise;
    }

    var allQueryPromise = [this.performTimeSeriesQuery(queries, start, end, maxDataPoints, minDesiredQuantization)];
    //TODO: fix list (should not be a list)

    return $q.all(allQueryPromise).then(function(allResponse) {
      var result = [];
      _.each(allResponse, function(response, index) {
        if (response.status === 'error') {
          self.lastErrors.query = response.error;
          throw response.error;
        }
        delete self.lastErrors.query;
        result = self.transformMetricData(response.data.response);
      });

      return { data: result };
    });
  };

  this.performTimeSeriesQuery = function(queries, start, end, maxDataPoints, minDesiredQuantization) {
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
    if (minDesiredQuantization !== Infinity){
      data['desiredQuantizationInSecs'] = minDesiredQuantization;
    }
    return this._request('POST', url, data);
  };

  this.performSuggestQuery = function(query) {
    //var url = '/api/v1/metrics/dimensions/suggest/key';
    var url = '/api/v1/metrics/suggest/autocomplete';
    var data = {
      query: query,
      //dimensions: []
    };
    return this._request('POST', url, data).then(function(result) {
      return _.map(result.data.suggestions, function (suggestion) {
          return suggestion.text;
      });
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

    var metricFindQuery = new PrometheusMetricFindQuery(this, interpolated, timeSrv);
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

    for (var i = 0; i < responses.length; i++) {
      var response = responses[i];

      if (response.messageType) {
        console.log("SumoMetricsDatasource.query -  " +
          "WARN: message: " + response.message + ", type: " + response.messageType +
          " for response[" + i + "]");
        continue; // TODO: How to display warning?
      }
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
    return Math.ceil(date.valueOf() / 1000);
  };
}
