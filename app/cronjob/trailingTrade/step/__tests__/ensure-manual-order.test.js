/* eslint-disable global-require */
const moment = require('moment');

describe('ensure-manual-order.js', () => {
  let result;
  let rawData;

  let binanceMock;
  let slackMock;
  let loggerMock;
  let cacheMock;
  let PubSubMock;

  let mockCalculateLastBuyPrice;
  let mockGetAPILimit;
  let mockSaveOrder;

  let mockGetSymbolGridTrade;
  let mockSaveSymbolGridTrade;

  describe('execute', () => {
    beforeEach(() => {
      jest.clearAllMocks().resetModules();
    });

    beforeEach(async () => {
      const {
        binance,
        slack,
        cache,
        logger,
        PubSub
      } = require('../../../../helpers');

      binanceMock = binance;
      slackMock = slack;
      loggerMock = logger;
      cacheMock = cache;
      PubSubMock = PubSub;

      cacheMock.hgetall = jest.fn().mockResolvedValue(null);
      cacheMock.hdel = jest.fn().mockResolvedValue(true);
      cacheMock.hset = jest.fn().mockResolvedValue(true);

      PubSubMock.publish = jest.fn().mockResolvedValue(true);

      slackMock.sendMessage = jest.fn().mockResolvedValue(true);
      binanceMock.client.getOrder = jest.fn().mockResolvedValue([]);

      mockCalculateLastBuyPrice = jest.fn().mockResolvedValue(true);
      mockGetAPILimit = jest.fn().mockResolvedValue(10);
      mockSaveOrder = jest.fn().mockResolvedValue(true);

      mockGetSymbolGridTrade = jest.fn().mockResolvedValue({
        buy: [
          {
            some: 'value'
          }
        ],
        sell: [{ some: 'value' }]
      });
      mockSaveSymbolGridTrade = jest.fn().mockResolvedValue(true);
    });

    describe('when manual buy order is not available', () => {
      beforeEach(async () => {
        jest.mock('../../../trailingTradeHelper/common', () => ({
          calculateLastBuyPrice: mockCalculateLastBuyPrice,
          getAPILimit: mockGetAPILimit,
          saveOrder: mockSaveOrder
        }));

        jest.mock('../../../trailingTradeHelper/configuration', () => ({
          getSymbolGridTrade: mockGetSymbolGridTrade,
          saveSymbolGridTrade: mockSaveSymbolGridTrade
        }));

        cacheMock.hgetall = jest.fn().mockResolvedValue(null);

        const step = require('../ensure-manual-order');

        rawData = {
          symbol: 'BTCUSDT',
          isLocked: false,
          featureToggle: { notifyDebug: true },
          symbolConfiguration: {
            system: {
              checkManualOrderPeriod: 10
            }
          }
        };

        result = await step.execute(loggerMock, rawData);
      });

      it('does not trigger binance.client.getOrder', () => {
        expect(binanceMock.client.getOrder).not.toHaveBeenCalled();
      });

      it('does not trigger cache.hdel', () => {
        expect(cacheMock.hdel).not.toHaveBeenCalled();
      });

      it('does not trigger saveSymbolGridTrade', () => {
        expect(mockSaveSymbolGridTrade).not.toHaveBeenCalled();
      });

      it('does not trigger saveOrder', () => {
        expect(mockSaveOrder).not.toHaveBeenCalled();
      });

      it('does not trigger calculateLastBuyPrice', () => {
        expect(mockCalculateLastBuyPrice).not.toHaveBeenCalled();
      });

      it('returns expected result', () => {
        expect(result).toStrictEqual({
          symbol: 'BTCUSDT',
          isLocked: false,
          featureToggle: { notifyDebug: true },
          symbolConfiguration: {
            system: {
              checkManualOrderPeriod: 10
            }
          }
        });
      });
    });

    describe('when manual buy order is already filled', () => {
      [
        {
          desc: 'with LIMIT order and has existing last buy price',
          symbol: 'CAKEUSDT',
          lastBuyPriceDoc: {
            lastBuyPrice: 30,
            quantity: 3
          },
          featureToggle: { notifyDebug: false },
          orderId: 159653829,
          cacheResults: {
            159653829: JSON.stringify({
              symbol: 'CAKEUSDT',
              orderId: 159653829,
              executedQty: '1.00000000',
              cummulativeQuoteQty: '19.54900000',
              status: 'FILLED',
              type: 'LIMIT',
              side: 'BUY'
            })
          }
        },
        {
          desc: 'with MARKET order and has no existing last buy price',
          symbol: 'BNBUSDT',
          lastBuyPriceDoc: null,
          featureToggle: { notifyDebug: true },
          orderId: 2371284112,
          cacheResults: {
            2371284112: JSON.stringify({
              symbol: 'BNBUSDT',
              orderId: 2371284112,
              executedQty: '0.12300000',
              cummulativeQuoteQty: '49.99581000',
              status: 'FILLED',
              type: 'MARKET',
              side: 'BUY',
              fills: [
                {
                  price: '406.47000000',
                  qty: '0.12300000',
                  commission: '0.00009225',
                  commissionAsset: 'BNB',
                  tradeId: 318836332
                }
              ]
            })
          }
        },
        {
          desc: 'with MARKET order and has existing last buy price',
          symbol: 'BNBUSDT',
          lastBuyPriceDoc: {
            lastBuyPrice: 20.782000000000004,
            quantity: 2.405
          },
          featureToggle: { notifyDebug: false },
          orderId: 160868057,
          cacheResults: {
            160868057: JSON.stringify({
              symbol: 'CAKEUSDT',
              orderId: 160868057,
              executedQty: '3.00000000',
              cummulativeQuoteQty: '61.33200000',
              status: 'FILLED',
              type: 'MARKET',
              side: 'BUY',
              fills: [
                {
                  price: '20.44400000',
                  qty: '3.00000000',
                  commission: '0.00010912',
                  commissionAsset: 'BNB',
                  tradeId: 26893880
                }
              ]
            })
          }
        }
      ].forEach(testData => {
        describe(`${testData.desc}`, () => {
          beforeEach(async () => {
            jest.mock('../../../trailingTradeHelper/common', () => ({
              calculateLastBuyPrice: mockCalculateLastBuyPrice,
              getAPILimit: mockGetAPILimit,
              saveOrder: mockSaveOrder
            }));

            jest.mock('../../../trailingTradeHelper/configuration', () => ({
              getSymbolGridTrade: mockGetSymbolGridTrade,
              saveSymbolGridTrade: mockSaveSymbolGridTrade
            }));

            cacheMock.hgetall = jest
              .fn()
              .mockResolvedValue(testData.cacheResults);

            const step = require('../ensure-manual-order');

            rawData = {
              symbol: testData.symbol,
              featureToggle: testData.featureToggle,
              isLocked: false,
              symbolConfiguration: {
                system: {
                  checkManualOrderPeriod: 10
                }
              }
            };

            result = await step.execute(loggerMock, rawData);
          });

          it('triggers calculateLastBuyPrice', () => {
            expect(mockCalculateLastBuyPrice).toHaveBeenCalledWith(
              loggerMock,
              testData.symbol,
              JSON.parse(testData.cacheResults[testData.orderId])
            );
          });

          it('triggers cache.hdel', () => {
            expect(cacheMock.hdel).toHaveBeenCalledWith(
              `trailing-trade-manual-order-${testData.symbol}`,
              testData.orderId
            );
          });

          it('triggers getSymbolGridTrade', () => {
            expect(mockGetSymbolGridTrade).toHaveBeenCalledWith(
              loggerMock,
              testData.symbol
            );
          });

          it('triggers saveSymbolGridTrade', () => {
            expect(mockSaveSymbolGridTrade).toHaveBeenCalledWith(
              loggerMock,
              testData.symbol,
              {
                buy: [
                  {
                    some: 'value'
                  }
                ],
                sell: [{ some: 'value' }],
                manualTrade: [
                  JSON.parse(testData.cacheResults[testData.orderId])
                ]
              }
            );
          });

          it('triggers saveOrder', () => {
            expect(mockSaveOrder).toHaveBeenCalledWith(loggerMock, {
              order: JSON.parse(testData.cacheResults[testData.orderId]),
              botStatus: {
                savedAt: expect.any(String),
                savedBy: 'ensure-manual-order',
                savedMessage:
                  'The order has already filled and updated the last buy price.'
              }
            });
          });
        });
      });
    });

    describe('when manual buy order is not filled', () => {
      [
        {
          desc: 'with LIMIT order and FILLED',
          symbol: 'CAKEUSDT',
          lastBuyPriceDoc: {
            lastBuyPrice: 30,
            quantity: 3
          },
          featureToggle: { notifyDebug: false },
          orderId: 159653829,
          cacheResults: {
            159653829: JSON.stringify({
              symbol: 'CAKEUSDT',
              orderId: 159653829,
              origQty: '1.00000000',
              executedQty: '1.00000000',
              cummulativeQuoteQty: '19.54900000',
              status: 'NEW',
              type: 'LIMIT',
              side: 'BUY',
              nextCheck: moment()
                .subtract(1, 'minute')
                .format('YYYY-MM-DDTHH:mm:ssZ')
            })
          },
          getOrderResult: {
            symbol: 'CAKEUSDT',
            orderId: 159653829,
            executedQty: '1.00000000',
            cummulativeQuoteQty: '19.54900000',
            status: 'FILLED',
            type: 'LIMIT',
            side: 'BUY'
          },
          expectedCalculateLastBuyPrice: true
        },
        {
          desc: 'with MARKET order and FILLED',
          symbol: 'CAKEUSDT',
          lastBuyPriceDoc: {
            lastBuyPrice: 30,
            quantity: 3
          },
          featureToggle: { notifyDebug: true },
          orderId: 159653829,
          cacheResults: {
            159653829: JSON.stringify({
              symbol: 'CAKEUSDT',
              orderId: 159653829,
              origQty: '1.00000000',
              executedQty: '1.00000000',
              cummulativeQuoteQty: '19.54900000',
              status: 'NEW',
              type: 'MARKET',
              side: 'BUY',
              nextCheck: moment()
                .subtract(5, 'minute')
                .format('YYYY-MM-DDTHH:mm:ssZ')
            })
          },
          getOrderResult: {
            symbol: 'CAKEUSDT',
            orderId: 159653829,
            executedQty: '1.00000000',
            cummulativeQuoteQty: '19.54900000',
            status: 'FILLED',
            type: 'MARKET',
            side: 'BUY'
          },
          expectedCalculateLastBuyPrice: true
        },
        {
          desc: 'with MARKET order and FILLED, but not yet to check',
          symbol: 'CAKEUSDT',
          lastBuyPriceDoc: {
            lastBuyPrice: 30,
            quantity: 3
          },
          featureToggle: { notifyDebug: false },
          orderId: 159653829,
          cacheResults: {
            159653829: JSON.stringify({
              symbol: 'CAKEUSDT',
              orderId: 159653829,
              origQty: '1.00000000',
              executedQty: '1.00000000',
              cummulativeQuoteQty: '19.54900000',
              status: 'NEW',
              type: 'MARKET',
              side: 'BUY',
              nextCheck: moment()
                .add(5, 'minute')
                .format('YYYY-MM-DDTHH:mm:ssZ')
            })
          },
          getOrderResult: {
            symbol: 'CAKEUSDT',
            orderId: 159653829,
            executedQty: '1.00000000',
            cummulativeQuoteQty: '19.54900000',
            status: 'FILLED',
            type: 'MARKET',
            side: 'BUY'
          },
          expectedCalculateLastBuyPrice: false
        }
      ].forEach(testData => {
        describe(`${testData.desc}`, () => {
          beforeEach(async () => {
            jest.mock('../../../trailingTradeHelper/common', () => ({
              calculateLastBuyPrice: mockCalculateLastBuyPrice,
              getAPILimit: mockGetAPILimit,
              saveOrder: mockSaveOrder
            }));

            cacheMock.hgetall = jest
              .fn()
              .mockResolvedValue(testData.cacheResults);

            binanceMock.client.getOrder = jest
              .fn()
              .mockResolvedValue(testData.getOrderResult);

            const step = require('../ensure-manual-order');

            rawData = {
              symbol: testData.symbol,
              featureToggle: testData.featureToggle,
              isLocked: false,
              symbolConfiguration: {
                system: {
                  checkManualOrderPeriod: 10
                }
              }
            };

            result = await step.execute(loggerMock, rawData);
          });

          if (testData.expectedCalculateLastBuyPrice) {
            it('triggers calculateLastBuyPrice', () => {
              expect(mockCalculateLastBuyPrice).toHaveBeenCalledWith(
                loggerMock,
                testData.symbol,
                testData.getOrderResult
              );
            });

            it('triggers cache.hdel', () => {
              expect(cacheMock.hdel).toHaveBeenCalledWith(
                `trailing-trade-manual-order-${testData.symbol}`,
                testData.orderId
              );
            });

            it('triggers getSymbolGridTrade', () => {
              expect(mockGetSymbolGridTrade).toHaveBeenCalledWith(
                loggerMock,
                testData.symbol
              );
            });

            it('triggers saveSymbolGridTrade', () => {
              expect(mockSaveSymbolGridTrade).toHaveBeenCalledWith(
                loggerMock,
                testData.symbol,
                {
                  buy: [
                    {
                      some: 'value'
                    }
                  ],
                  sell: [{ some: 'value' }],
                  manualTrade: [testData.getOrderResult]
                }
              );
            });

            it('triggers saveOrder', () => {
              expect(mockSaveOrder).toHaveBeenCalledWith(loggerMock, {
                order: {
                  ...JSON.parse(testData.cacheResults[testData.orderId]),
                  ...testData.getOrderResult
                },
                botStatus: {
                  savedAt: expect.any(String),
                  savedBy: 'ensure-manual-order',
                  savedMessage:
                    'The order has filled and updated the last buy price.'
                }
              });
            });
          } else {
            it('does not trigger calculateLastBuyPrice', () => {
              expect(mockCalculateLastBuyPrice).not.toHaveBeenCalled();
            });

            it('does not trigger cache.hdel', () => {
              expect(cacheMock.hdel).not.toHaveBeenCalled();
            });

            it('does not trigger getSymbolGridTrade', () => {
              expect(mockGetSymbolGridTrade).not.toHaveBeenCalled();
            });

            it('does not trigger saveSymbolGridTrade', () => {
              expect(mockSaveSymbolGridTrade).not.toHaveBeenCalled();
            });

            it('does not trigger saveOrder', () => {
              expect(mockSaveOrder).not.toHaveBeenCalled();
            });
          }

          it('does not trigger cache.hset', () => {
            expect(cacheMock.hset).not.toHaveBeenCalled();
          });
        });
      });

      [
        {
          desc: 'with LIMIT order and CANCELED',
          symbol: 'CAKEUSDT',
          orderId: 159653829,
          cacheResults: {
            159653829: JSON.stringify({
              symbol: 'CAKEUSDT',
              orderId: 159653829,
              origQty: '1.00000000',
              executedQty: '1.00000000',
              cummulativeQuoteQty: '19.54900000',
              status: 'NEW',
              type: 'LIMIT',
              side: 'BUY',
              nextCheck: moment()
                .subtract(1, 'minute')
                .format('YYYY-MM-DDTHH:mm:ssZ')
            })
          },
          getOrderResult: {
            symbol: 'CAKEUSDT',
            orderId: 159653829,
            executedQty: '1.00000000',
            cummulativeQuoteQty: '19.54900000',
            status: 'CANCELED',
            type: 'LIMIT',
            side: 'BUY'
          }
        },
        {
          desc: 'with LIMIT order and REJECTED',
          symbol: 'CAKEUSDT',
          orderId: 159653829,
          cacheResults: {
            159653829: JSON.stringify({
              symbol: 'CAKEUSDT',
              orderId: 159653829,
              origQty: '1.00000000',
              executedQty: '1.00000000',
              cummulativeQuoteQty: '19.54900000',
              status: 'NEW',
              type: 'LIMIT',
              side: 'BUY',
              nextCheck: moment()
                .subtract(1, 'minute')
                .format('YYYY-MM-DDTHH:mm:ssZ')
            })
          },
          getOrderResult: {
            symbol: 'CAKEUSDT',
            orderId: 159653829,
            executedQty: '1.00000000',
            cummulativeQuoteQty: '19.54900000',
            status: 'REJECTED',
            type: 'LIMIT',
            side: 'BUY'
          }
        },
        {
          desc: 'with LIMIT order and EXPIRED',
          symbol: 'CAKEUSDT',
          orderId: 159653829,
          cacheResults: {
            159653829: JSON.stringify({
              symbol: 'CAKEUSDT',
              orderId: 159653829,
              origQty: '1.00000000',
              executedQty: '1.00000000',
              cummulativeQuoteQty: '19.54900000',
              status: 'NEW',
              type: 'LIMIT',
              side: 'BUY',
              nextCheck: moment()
                .subtract(1, 'minute')
                .format('YYYY-MM-DDTHH:mm:ssZ')
            })
          },
          getOrderResult: {
            symbol: 'CAKEUSDT',
            orderId: 159653829,
            executedQty: '1.00000000',
            cummulativeQuoteQty: '19.54900000',
            status: 'EXPIRED',
            type: 'LIMIT',
            side: 'BUY'
          }
        },
        {
          desc: 'with LIMIT order and PENDING_CANCEL',
          symbol: 'CAKEUSDT',
          orderId: 159653829,
          cacheResults: {
            159653829: JSON.stringify({
              symbol: 'CAKEUSDT',
              orderId: 159653829,
              origQty: '1.00000000',
              executedQty: '1.00000000',
              cummulativeQuoteQty: '19.54900000',
              status: 'NEW',
              type: 'LIMIT',
              side: 'BUY',
              nextCheck: moment()
                .subtract(1, 'minute')
                .format('YYYY-MM-DDTHH:mm:ssZ')
            })
          },
          getOrderResult: {
            symbol: 'CAKEUSDT',
            orderId: 159653829,
            executedQty: '1.00000000',
            cummulativeQuoteQty: '19.54900000',
            status: 'PENDING_CANCEL',
            type: 'LIMIT',
            side: 'BUY'
          }
        },
        {
          desc: 'with LIMIT order and CANCELED',
          symbol: 'CAKEUSDT',
          orderId: 159653829,
          cacheResults: {
            159653829: JSON.stringify({
              symbol: 'CAKEUSDT',
              orderId: 159653829,
              origQty: '1.00000000',
              executedQty: '1.00000000',
              cummulativeQuoteQty: '19.54900000',
              status: 'NEW',
              type: 'LIMIT',
              side: 'BUY',
              nextCheck: moment()
                .subtract(1, 'minute')
                .format('YYYY-MM-DDTHH:mm:ssZ')
            })
          },
          getOrderResult: {
            symbol: 'CAKEUSDT',
            orderId: 159653829,
            executedQty: '1.00000000',
            cummulativeQuoteQty: '19.54900000',
            status: 'CANCELED',
            type: 'LIMIT',
            side: 'BUY'
          }
        }
      ].forEach(testData => {
        describe(`${testData.desc}`, () => {
          beforeEach(async () => {
            cacheMock.hgetall = jest
              .fn()
              .mockResolvedValue(testData.cacheResults);

            binanceMock.client.getOrder = jest
              .fn()
              .mockResolvedValue(testData.getOrderResult);

            const step = require('../ensure-manual-order');

            rawData = {
              symbol: testData.symbol,
              featureToggle: { notifyDebug: true },
              isLocked: false,
              symbolConfiguration: {
                system: {
                  checkManualOrderPeriod: 10
                }
              }
            };

            result = await step.execute(loggerMock, rawData);
          });

          it('does not trigger calculateLastBuyPrice', () => {
            expect(mockCalculateLastBuyPrice).not.toHaveBeenCalled();
          });

          it('triggers cache.hdel', () => {
            expect(cacheMock.hdel).toHaveBeenCalledWith(
              `trailing-trade-manual-order-${testData.symbol}`,
              testData.orderId
            );
          });

          it('does not trigger getSymbolGridTrade', () => {
            expect(mockGetSymbolGridTrade).not.toHaveBeenCalled();
          });

          it('does not trigger saveSymbolGridTrade', () => {
            expect(mockSaveSymbolGridTrade).not.toHaveBeenCalled();
          });

          it('triggers saveOrder', () => {
            expect(mockSaveOrder).toHaveBeenCalledWith(loggerMock, {
              order: {
                ...JSON.parse(testData.cacheResults[testData.orderId]),
                ...testData.getOrderResult
              },
              botStatus: {
                savedAt: expect.any(String),
                savedBy: 'ensure-manual-order',
                savedMessage:
                  'The order is no longer valid. Removed from the cache.'
              }
            });
          });
        });
      });

      [
        {
          desc: 'with LIMIT order and still NEW',
          symbol: 'CAKEUSDT',
          orderId: 159653829,
          cacheResults: {
            159653829: JSON.stringify({
              symbol: 'CAKEUSDT',
              orderId: 159653829,
              origQty: '1.00000000',
              executedQty: '1.00000000',
              cummulativeQuoteQty: '19.54900000',
              status: 'NEW',
              type: 'LIMIT',
              side: 'BUY',
              nextCheck: moment()
                .subtract(1, 'minute')
                .format('YYYY-MM-DDTHH:mm:ssZ')
            })
          },
          getOrderResult: {
            symbol: 'CAKEUSDT',
            orderId: 159653829,
            executedQty: '1.00000000',
            cummulativeQuoteQty: '19.54900000',
            status: 'NEW',
            type: 'LIMIT',
            side: 'BUY'
          }
        }
      ].forEach(testData => {
        describe(`${testData.desc}`, () => {
          beforeEach(async () => {
            cacheMock.hgetall = jest
              .fn()
              .mockResolvedValue(testData.cacheResults);

            binanceMock.client.getOrder = jest
              .fn()
              .mockResolvedValue(testData.getOrderResult);

            const step = require('../ensure-manual-order');

            rawData = {
              symbol: testData.symbol,
              featureToggle: { notifyDebug: true },
              isLocked: false,
              symbolConfiguration: {
                system: {
                  checkManualOrderPeriod: 10
                }
              }
            };

            result = await step.execute(loggerMock, rawData);
          });

          it('does not trigger calculateLastBuyPrice', () => {
            expect(mockCalculateLastBuyPrice).not.toHaveBeenCalled();
          });

          it('does not trigger cache.hdel', () => {
            expect(cacheMock.hdel).not.toHaveBeenCalled();
          });

          it('triggers cache.hset', () => {
            expect(cacheMock.hset).toHaveBeenCalledWith(
              `trailing-trade-manual-order-${testData.symbol}`,
              testData.orderId,
              expect.any(String)
            );
          });

          it('does not trigger getSymbolGridTrade', () => {
            expect(mockGetSymbolGridTrade).not.toHaveBeenCalled();
          });

          it('does not trigger saveSymbolGridTrade', () => {
            expect(mockSaveSymbolGridTrade).not.toHaveBeenCalled();
          });

          it('triggers saveOrder', () => {
            expect(mockSaveOrder).toHaveBeenCalledWith(loggerMock, {
              order: {
                ...testData.getOrderResult
              },
              botStatus: {
                savedAt: expect.any(String),
                savedBy: 'ensure-manual-order',
                savedMessage: 'The order is not filled. Check next internal.'
              }
            });
          });
        });
      });

      describe('when binance.client.getOrder throws an error', () => {
        beforeEach(async () => {
          cacheMock.hgetall = jest.fn().mockResolvedValue({
            159653829: JSON.stringify({
              symbol: 'CAKEUSDT',
              orderId: 159653829,
              origQty: '1.00000000',
              executedQty: '1.00000000',
              cummulativeQuoteQty: '19.54900000',
              status: 'NEW',
              type: 'LIMIT',
              side: 'BUY',
              nextCheck: moment()
                .subtract(1, 'minute')
                .format('YYYY-MM-DDTHH:mm:ssZ')
            })
          });

          binanceMock.client.getOrder = jest
            .fn()
            .mockRejectedValue(new Error('Order is not found.'));

          const step = require('../ensure-manual-order');

          rawData = {
            symbol: 'CAKEUSDT',
            featureToggle: { notifyDebug: true },
            isLocked: false,
            symbolConfiguration: {
              system: {
                checkManualOrderPeriod: 10
              }
            }
          };

          result = await step.execute(loggerMock, rawData);
        });

        it('does not trigger calculateLastBuyPrice', () => {
          expect(mockCalculateLastBuyPrice).not.toHaveBeenCalled();
        });

        it('does not trigger cache.hdel', () => {
          expect(cacheMock.hdel).not.toHaveBeenCalled();
        });

        it('does not trigger getSymbolGridTrade', () => {
          expect(mockGetSymbolGridTrade).not.toHaveBeenCalled();
        });

        it('does not trigger saveSymbolGridTrade', () => {
          expect(mockSaveSymbolGridTrade).not.toHaveBeenCalled();
        });

        it('triggers cache.hset', () => {
          expect(cacheMock.hset).toHaveBeenCalledWith(
            `trailing-trade-manual-order-CAKEUSDT`,
            159653829,
            expect.any(String)
          );
        });

        it('triggers saveOrder', () => {
          expect(mockSaveOrder).toHaveBeenCalledWith(loggerMock, {
            order: {
              symbol: 'CAKEUSDT',
              orderId: 159653829,
              origQty: '1.00000000',
              executedQty: '1.00000000',
              cummulativeQuoteQty: '19.54900000',
              status: 'NEW',
              type: 'LIMIT',
              side: 'BUY',
              nextCheck: expect.any(String)
            },
            botStatus: {
              savedAt: expect.any(String),
              savedBy: 'ensure-manual-order',
              savedMessage:
                'The order could not be found or error occurred querying the order.'
            }
          });
        });
      });
    });
  });
});
