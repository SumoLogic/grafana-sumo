FROM grafana/grafana:4.2.0

ADD public_gen/app/plugins/datasource/sumo/ /usr/share/grafana/public/app/plugins/datasource/sumo/


