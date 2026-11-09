export const csPaths = {
  "/api/v2/cs/search": {
    "get": {
      "summary": "Поиск словоформ и русских эквивалентов",
      "security": [],
      "parameters": [
        {
          "name": "q",
          "in": "query",
          "required": true,
          "schema": {
            "type": "string",
            "minLength": 1,
            "maxLength": 120
          }
        },
        {
          "name": "direction",
          "in": "query",
          "schema": {
            "type": "string",
            "enum": [
              "cu-ru",
              "ru-cu"
            ],
            "default": "cu-ru"
          }
        },
        {
          "name": "cursor",
          "in": "query",
          "schema": {
            "type": "string"
          }
        },
        {
          "name": "limit",
          "in": "query",
          "schema": {
            "type": "integer",
            "minimum": 1,
            "maximum": 50,
            "default": 20
          }
        }
      ],
      "responses": {
        "200": {
          "description": "Успешный ответ",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/CsSearch"
              }
            }
          }
        },
        "400": {
          "description": "Некорректный запрос",
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {}
              }
            }
          }
        },
        "429": {
          "description": "Повторить запрос через Retry-After",
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {}
              }
            }
          }
        },
        "503": {
          "description": "Сервис временно недоступен",
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {}
              }
            }
          }
        }
      }
    }
  },
  "/api/v2/cs/lexemes/{id}": {
    "get": {
      "summary": "Словарная статья, формы и связи",
      "security": [],
      "parameters": [
        {"name":"view","in":"query","description":"relations: только лексема и смысловые связи, без таблиц форм и объяснений","schema":{"type":"string","enum":["relations"]}},
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string",
            "pattern": "^[a-f0-9]{24}$"
          }
        }
      ],
      "responses": {
        "200": {
          "description": "Успешный ответ",
          "content": {
            "application/json": {
              "schema": {
                "oneOf": [{"$ref": "#/components/schemas/CsArticle"}, {"$ref": "#/components/schemas/CsRelationView"}]
              }
            }
          }
        },
        "404": {
          "description": "Статья не найдена",
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {}
              }
            }
          }
        },
        "400": {
          "description": "Некорректный запрос",
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {}
              }
            }
          }
        },
        "429": {
          "description": "Повторить запрос через Retry-After",
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {}
              }
            }
          }
        },
        "503": {
          "description": "Сервис временно недоступен",
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {}
              }
            }
          }
        }
      }
    }
  },
  "/api/v2/cs/source-entries/{id}": {
    "get": {
      "summary": "Статья источника в безопасной разметке",
      "description": "Данные атрибутированы конкретным источникам; общая лицензия корпуса не присваивается заимствованным материалам.",
      "security": [],
      "parameters": [
        {
          "name": "id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string",
            "pattern": "^[a-f0-9]{64}$"
          }
        }
      ],
      "responses": {
        "200": {
          "description": "Успешный ответ",
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/CsSource"
              }
            }
          }
        },
        "404": {
          "description": "Материал не найден",
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {}
              }
            }
          }
        },
        "400": {
          "description": "Некорректный запрос",
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {}
              }
            }
          }
        },
        "429": {
          "description": "Повторить запрос через Retry-After",
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {}
              }
            }
          }
        },
        "503": {
          "description": "Сервис временно недоступен",
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {}
              }
            }
          }
        }
      }
    }
  },
  "/api/v2/cs/reports": {
    "post": {
      "summary": "Явно отправленное сообщение о словаре",
      "security": [],
      "requestBody": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "properties": {
                "reason": {
                  "type": "string",
                  "enum": [
                    "missing",
                    "inaccurate",
                    "morphology",
                    "source",
                    "other"
                  ]
                },
                "comment": {
                  "type": "string",
                  "minLength": 3,
                  "maxLength": 2000
                },
                "query": {
                  "type": "string",
                  "maxLength": 120
                },
                "lexemeId": {
                  "type": "string"
                }
              },
              "required": [
                "reason",
                "comment"
              ]
            }
          }
        }
      },
      "responses": {
        "201": {
          "description": "Сообщение принято",
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "accepted": {
                    "type": "boolean"
                  }
                }
              }
            }
          }
        },
        "413": {
          "description": "Превышен размер сообщения",
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {}
              }
            }
          }
        },
        "400": {
          "description": "Некорректный запрос",
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {}
              }
            }
          }
        },
        "429": {
          "description": "Повторить запрос через Retry-After",
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {}
              }
            }
          }
        },
        "503": {
          "description": "Сервис временно недоступен",
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {}
              }
            }
          }
        }
      }
    }
  }
};
export const csSchemas = {
  "CsSearch": {
    "type": "object",
    "properties": {
      "version": {
        "type": "string"
      },
      "query": {
        "type": "string"
      },
      "direction": {
        "type": "string",
        "enum": [
          "cu-ru",
          "ru-cu"
        ]
      },
      "items": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "id": {
              "type": "string"
            },
            "name": {
              "type": "string"
            },
            "pos": {
              "type": "string"
            },
            "match": {
              "type": "string",
              "enum": [
                "lemma",
                "stored-form",
                "source-variant",
                "generated-form",
                "translation",
                "explanation"
              ]
            },
            "matched": {
              "type": "string"
            },
            "grammar": {
              "type": "string"
            },
            "exact": {
              "type": "boolean",
              "description": "Точное совпадение поискового ключа; false при префиксном совпадении."
            },
            "rank": {
              "type": "integer"
            }
          },
          "required": [
            "id",
            "name",
            "match",
            "matched",
            "exact",
            "grammar"
          ]
        }
      },
      "nextCursor": {
        "type": [
          "string",
          "null"
        ]
      }
    },
    "required": [
      "version",
      "query",
      "direction",
      "items",
      "nextCursor"
    ]
  },
  "CsRelationView": {"type":"object","properties":{"id":{"type":"string"},"name":{"type":"string"},"pos":{"type":"string"},"version":{"type":"string"},"relations":{"$ref":"#/components/schemas/CsArticle/properties/relations"}},"required":["id","name","pos","version","relations"]},
  "CsArticle": {
    "type": "object",
    "properties": {
      "id": {
        "type": "string"
      },
      "name": {
        "type": "string"
      },
      "originalName": {
        "type": "string"
      },
      "version": {
        "type": "string"
      },
      "properties": {
        "type": "array",
        "items": {
          "type": "string"
        }
      },
      "morphologyStatus": {
        "type": "string",
        "enum": [
          "supported",
          "notApplicable",
          "unassigned"
        ]
      },
      "sources": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {}
        }
      },
      "paradigms": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {}
        }
      },
      "extra": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {}
        }
      },
      "relations": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {}
        }
      },
      "etymologies": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {}
        }
      },
      "usage": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {}
        }
      },
      "composition": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {}
        }
      },
      "examples": {
        "type": "array",
        "items": {
          "$ref": "#/components/schemas/CsExample"
        }
      }
    },
    "required": [
      "id",
      "name",
      "version",
      "sources",
      "paradigms",
      "relations",
      "etymologies"
    ]
  },
  "CsSource": {
    "type": "object",
    "properties": {
      "id": {
        "type": "string"
      },
      "entryId": {
        "type": "string"
      },
      "sourceCode": {
        "type": "string"
      },
      "title": {
        "type": "string"
      },
      "version": {
        "type": "string"
      },
      "publicationVersion": {
        "type": "string"
      },
      "paragraphs": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "runs": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "text": {
                    "type": "string"
                  },
                  "kind": {
                    "type": "string",
                    "enum": [
                      "text",
                      "church",
                      "emphasis",
                      "strong",
                      "reference"
                    ]
                  },
                  "target": {
                    "type": "string"
                  }
                }
              }
            }
          }
        }
      },
      "anchors": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {}
        }
      },
      "examples": {
        "type": "array",
        "items": {
          "$ref": "#/components/schemas/CsExample"
        }
      }
    },
    "required": [
      "id",
      "entryId",
      "sourceCode",
      "title",
      "version",
      "paragraphs",
      "anchors"
    ]
  },
  "CsExample": {
    "type": "object",
    "properties": {
      "id": {
        "type": "string"
      },
      "quote": {
        "type": "string"
      },
      "citation": {
        "type": "string"
      },
      "sourceId": {
        "type": "string"
      },
      "sourceTitle": {
        "type": "string"
      },
      "sourceVersion": {
        "type": "string"
      },
      "anchorId": {
        "type": [
          "string",
          "null"
        ]
      },
      "script": {
        "type": "string",
        "enum": [
          "church",
          "source"
        ]
      },
      "basis": {
        "type": "string",
        "enum": [
          "styled-citation"
        ]
      }
    },
    "required": [
      "id",
      "quote",
      "citation",
      "sourceId",
      "sourceTitle",
      "sourceVersion",
      "anchorId",
      "script",
      "basis"
    ]
  }
};
