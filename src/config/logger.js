'use strict';

const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const env = require('./env');

const { combine, timestamp, json, errors, colorize, simple } = winston.format;

const baseFormat = combine(
  errors({ stack: true }),
  timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
  json()
);

const consoleFormat = combine(
  colorize(),
  timestamp({ format: 'HH:mm:ss' }),
  simple()
);

const transports = [];

if (env.isDev) {
  transports.push(
    new winston.transports.Console({
      format: consoleFormat,
      level: env.logLevel,
    })
  );
} else {
  transports.push(
    new winston.transports.Console({
      format: baseFormat,
      level: env.logLevel,
    })
  );
}

transports.push(
  new DailyRotateFile({
    filename: 'logs/app-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxSize: '10m',
    maxFiles: '7d',
    format: baseFormat,
    level: env.logLevel,
  }),
  new DailyRotateFile({
    filename: 'logs/error-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxSize: '10m',
    maxFiles: '30d',
    format: baseFormat,
    level: 'error',
  })
);

const logger = winston.createLogger({
  defaultMeta: { service: 'amrioxwa' },
  transports,
});

module.exports = logger;
