import type * as Monaco from 'monaco-editor';

interface TemplateItem {
  label: string;
  insertText: string;
  detail: string;
  documentation: string;
}

const TRANSFORMER_NOTE =
  'Requires "transformers": ["response-template"] in the stub response definition.';

const templateItems: TemplateItem[] = [
  // Request data
  {
    label: 'request.url',
    insertText: '{{request.url}}',
    detail: 'Request Data',
    documentation: `The full request URL including query string. ${TRANSFORMER_NOTE}`
  },
  {
    label: 'request.path',
    insertText: '{{request.path}}',
    detail: 'Request Data',
    documentation: `The request path (without query string). ${TRANSFORMER_NOTE}`
  },
  {
    label: 'request.method',
    insertText: '{{request.method}}',
    detail: 'Request Data',
    documentation: `The HTTP method (GET, POST, PUT, etc.). ${TRANSFORMER_NOTE}`
  },
  {
    label: 'request.body',
    insertText: '{{request.body}}',
    detail: 'Request Data',
    documentation: `The entire request body as a string. ${TRANSFORMER_NOTE}`
  },
  {
    label: 'request.host',
    insertText: '{{request.host}}',
    detail: 'Request Data',
    documentation: `The request host name. ${TRANSFORMER_NOTE}`
  },
  {
    label: 'request.scheme',
    insertText: '{{request.scheme}}',
    detail: 'Request Data',
    documentation: `The request scheme (http or https). ${TRANSFORMER_NOTE}`
  },
  {
    label: 'request.port',
    insertText: '{{request.port}}',
    detail: 'Request Data',
    documentation: `The request port number. ${TRANSFORMER_NOTE}`
  },
  {
    label: 'request.baseUrl',
    insertText: '{{request.baseUrl}}',
    detail: 'Request Data',
    documentation: `The base URL (scheme + host + port). ${TRANSFORMER_NOTE}`
  },
  {
    label: 'request.headers.HEADER_NAME',
    insertText: '{{request.headers.${1:Content-Type}}}',
    detail: 'Request Data',
    documentation: `Value of a specific request header. ${TRANSFORMER_NOTE}`
  },
  {
    label: 'request.query.PARAM_NAME',
    insertText: '{{request.query.${1:paramName}}}',
    detail: 'Request Data',
    documentation: `Value of a specific query parameter. ${TRANSFORMER_NOTE}`
  },
  {
    label: 'request.pathSegments.[INDEX]',
    insertText: '{{request.pathSegments.[${1:0}]}}',
    detail: 'Request Data',
    documentation: `A specific segment of the request path (0-indexed). ${TRANSFORMER_NOTE}`
  },
  {
    label: 'request.cookies',
    insertText: '{{request.cookies.${1:cookieName}}}',
    detail: 'Request Data',
    documentation: `Value of a specific cookie. ${TRANSFORMER_NOTE}`
  },
  {
    label: 'request.clientIp',
    insertText: '{{request.clientIp}}',
    detail: 'Request Data',
    documentation: `The IP address of the client making the request. ${TRANSFORMER_NOTE}`
  },

  // Date/time
  {
    label: 'now',
    insertText: '{{now}}',
    detail: 'Date/Time',
    documentation: `The current date and time in ISO 8601 format. ${TRANSFORMER_NOTE}`
  },
  {
    label: 'now offset',
    insertText: "{{now offset='${1:3 days}'}}",
    detail: 'Date/Time',
    documentation: `The current date/time with an offset. Examples: '3 days', '-2 hours', '1 month'. ${TRANSFORMER_NOTE}`
  },
  {
    label: 'now format',
    insertText: "{{now format='${1:yyyy-MM-dd}'}}",
    detail: 'Date/Time',
    documentation: `The current date/time formatted with a Java SimpleDateFormat pattern. ${TRANSFORMER_NOTE}`
  },
  {
    label: 'now offset + format',
    insertText: "{{now offset='${1:5 hours}' format='${2:yyyy-MM-dd HH:mm:ss}'}}",
    detail: 'Date/Time',
    documentation: `The current date/time with offset and custom format. ${TRANSFORMER_NOTE}`
  },
  {
    label: 'now timezone',
    insertText: "{{now timezone='${1:Asia/Tokyo}' format='${2:yyyy-MM-dd}'}}",
    detail: 'Date/Time',
    documentation: `The current date/time in a specific timezone with format. ${TRANSFORMER_NOTE}`
  },
  {
    label: 'date (parseDate)',
    insertText: "{{date (parseDate request.headers.${1:MyDate}) format='${2:yyyy-MM-dd}'}}",
    detail: 'Date/Time',
    documentation: `Parse a date string and reformat it. ${TRANSFORMER_NOTE}`
  },

  // Random values
  {
    label: "randomValue type='UUID'",
    insertText: "{{randomValue type='UUID'}}",
    detail: 'Random Values',
    documentation: `Generate a random UUID (e.g. 36a26963-8be0-4f3c-a1ed-1a7a29de7f64). ${TRANSFORMER_NOTE}`
  },
  {
    label: "randomValue type='ALPHANUMERIC'",
    insertText: "{{randomValue type='ALPHANUMERIC' length=${1:10}}}",
    detail: 'Random Values',
    documentation: `Generate a random alphanumeric string of the specified length. ${TRANSFORMER_NOTE}`
  },
  {
    label: "randomValue type='ALPHABETIC'",
    insertText: "{{randomValue type='ALPHABETIC' length=${1:5}}}",
    detail: 'Random Values',
    documentation: `Generate a random alphabetic string of the specified length. ${TRANSFORMER_NOTE}`
  },
  {
    label: "randomValue type='NUMERIC'",
    insertText: "{{randomValue type='NUMERIC' length=${1:8}}}",
    detail: 'Random Values',
    documentation: `Generate a random numeric string of the specified length. ${TRANSFORMER_NOTE}`
  },
  {
    label: 'randomValue uppercase',
    insertText: "{{randomValue type='ALPHANUMERIC' uppercase=true length=${1:16}}}",
    detail: 'Random Values',
    documentation: `Generate an uppercase random alphanumeric string. ${TRANSFORMER_NOTE}`
  },
  {
    label: 'randomInt',
    insertText: '{{randomInt lower=${1:1} upper=${2:100}}}',
    detail: 'Random Values',
    documentation: `Generate a random integer between lower and upper bounds. ${TRANSFORMER_NOTE}`
  },
  {
    label: 'randomDecimal',
    insertText: '{{randomDecimal lower=${1:0.0} upper=${2:1.0}}}',
    detail: 'Random Values',
    documentation: `Generate a random decimal between lower and upper bounds. ${TRANSFORMER_NOTE}`
  },

  // String helpers
  {
    label: 'trim',
    insertText: '{{trim ${1:request.body}}}',
    detail: 'String Helpers',
    documentation: `Remove leading and trailing whitespace from a string. ${TRANSFORMER_NOTE}`
  },
  {
    label: 'base64',
    insertText: '{{base64 ${1:request.body}}}',
    detail: 'String Helpers',
    documentation: `Base64 encode a string. ${TRANSFORMER_NOTE}`
  },
  {
    label: 'urlEncode',
    insertText: '{{urlEncode ${1:request.body}}}',
    detail: 'String Helpers',
    documentation: `URL-encode a string. ${TRANSFORMER_NOTE}`
  },
  {
    label: 'formData',
    insertText: "{{formData request.body '${1:fieldName}'}}",
    detail: 'String Helpers',
    documentation: `Extract a field value from URL-encoded form data. ${TRANSFORMER_NOTE}`
  },
  {
    label: 'regexExtract',
    insertText: "{{regexExtract request.body '${1:(regex)}' '${2:group}'}}",
    detail: 'String Helpers',
    documentation: `Extract a value from a string using a regular expression with capture group. ${TRANSFORMER_NOTE}`
  },
  {
    label: 'size',
    insertText: '{{size ${1:request.body}}}',
    detail: 'String Helpers',
    documentation: `Return the size of a string or collection. ${TRANSFORMER_NOTE}`
  },
  {
    label: 'capitalize',
    insertText: '{{capitalize ${1:request.body}}}',
    detail: 'String Helpers',
    documentation: `Capitalize the first letter of a string. ${TRANSFORMER_NOTE}`
  },

  // Math helpers
  {
    label: 'math (addition)',
    insertText: "{{math ${1:1} '+' ${2:2}}}",
    detail: 'Math',
    documentation: `Perform addition. ${TRANSFORMER_NOTE}`
  },
  {
    label: 'math (subtraction)',
    insertText: "{{math ${1:10} '-' ${2:3}}}",
    detail: 'Math',
    documentation: `Perform subtraction. ${TRANSFORMER_NOTE}`
  },
  {
    label: 'math (multiplication)',
    insertText: "{{math ${1:5} '*' ${2:4}}}",
    detail: 'Math',
    documentation: `Perform multiplication. ${TRANSFORMER_NOTE}`
  },
  {
    label: 'math (division)',
    insertText: "{{math ${1:10} '/' ${2:2}}}",
    detail: 'Math',
    documentation: `Perform division. ${TRANSFORMER_NOTE}`
  },
  {
    label: 'math (modulo)',
    insertText: "{{math ${1:10} '%' ${2:3}}}",
    detail: 'Math',
    documentation: `Perform modulo operation. ${TRANSFORMER_NOTE}`
  },

  // Conditionals
  {
    label: '#if (contains)',
    insertText: "{{#if (contains request.url '${1:/api}')}}${2:content}{{/if}}",
    detail: 'Conditional',
    documentation: `Conditional block using contains check. ${TRANSFORMER_NOTE}`
  },
  {
    label: '#if (eq) ... else',
    insertText: "{{#if (eq request.method '${1:POST}')}}${2:then}{{else}}${3:otherwise}{{/if}}",
    detail: 'Conditional',
    documentation: `If-else conditional with equality check. ${TRANSFORMER_NOTE}`
  },
  {
    label: '#if',
    insertText: '{{#if ${1:condition}}}${2:content}{{/if}}',
    detail: 'Conditional',
    documentation: `Conditional block that renders content if the condition is truthy. ${TRANSFORMER_NOTE}`
  },
  {
    label: '#if else',
    insertText: '{{#if ${1:condition}}}${2:then}{{else}}${3:otherwise}{{/if}}',
    detail: 'Conditional',
    documentation: `Conditional block with an else clause. ${TRANSFORMER_NOTE}`
  },
  {
    label: '#unless',
    insertText: "{{#unless (eq request.method '${1:GET}')}}${2:content}{{/unless}}",
    detail: 'Conditional',
    documentation: `Renders content if the condition is falsy (inverse of #if). ${TRANSFORMER_NOTE}`
  },
  {
    label: '#is',
    insertText: "{{#is request.method '${1:POST}'}}${2:content}{{/is}}",
    detail: 'Conditional',
    documentation: `Renders content if two values are equal. ${TRANSFORMER_NOTE}`
  },
  {
    label: '#contains',
    insertText: "{{#contains request.url '${1:search}'}}${2:content}{{/contains}}",
    detail: 'Conditional',
    documentation: `Renders content if the string contains the substring. ${TRANSFORMER_NOTE}`
  },
  {
    label: '#matches',
    insertText: "{{#matches request.url '${1:regex}'}}${2:content}{{/matches}}",
    detail: 'Conditional',
    documentation: `Renders content if the string matches the regular expression. ${TRANSFORMER_NOTE}`
  },

  // Iteration
  {
    label: '#each (jsonPath)',
    insertText:
      "{{#each (jsonPath request.body '${1:\\$.items}') as |${2:item}|}}${3:content}{{/each}}",
    detail: 'Iteration',
    documentation: `Iterate over a JSON array extracted via JSONPath. Use {{@index}} for 0-based index. ${TRANSFORMER_NOTE}`
  },
  {
    label: '#each (headers)',
    insertText: '{{#each request.headers as |${1:value} ${2:key}|}}${3:content}{{/each}}',
    detail: 'Iteration',
    documentation: `Iterate over request headers with key and value. ${TRANSFORMER_NOTE}`
  },
  {
    label: '#range',
    insertText: '{{#range ${1:1} ${2:5}}}{{@index}}{{/range}}',
    detail: 'Iteration',
    documentation: `Iterate over a numeric range. ${TRANSFORMER_NOTE}`
  },

  // JSON Processing
  {
    label: 'jsonPath',
    insertText: "{{jsonPath request.body '${1:\\$.name}'}}",
    detail: 'JSON Processing',
    documentation: `Extract a value from JSON using JSONPath. Example: $.store.book[0].title. ${TRANSFORMER_NOTE}`
  },
  {
    label: 'lookup (jsonPath)',
    insertText: "{{lookup (jsonPath request.body '${1:\\$.items}') ${2:0}}}",
    detail: 'JSON Processing',
    documentation: `Look up an element by index from a JSON array. ${TRANSFORMER_NOTE}`
  },
  {
    label: 'pickRandom (jsonPath)',
    insertText: "{{pickRandom (jsonPath request.body '${1:\\$.items}')}}",
    detail: 'JSON Processing',
    documentation: `Randomly select one element from a JSON array. ${TRANSFORMER_NOTE}`
  },
  {
    label: 'pickRandom (values)',
    insertText: "{{pickRandom '${1:value1}' '${2:value2}' '${3:value3}'}}",
    detail: 'JSON Processing',
    documentation: `Randomly select one value from a list of options. ${TRANSFORMER_NOTE}`
  },

  // XPath (XML)
  {
    label: 'xPath',
    insertText: "{{xPath request.body '${1:/root/name/text()}'}}",
    detail: 'XPath',
    documentation: `Extract a value from XML using XPath. ${TRANSFORMER_NOTE}`
  },
  {
    label: 'soapXPath',
    insertText: "{{soapXPath request.body '${1:/Envelope/Body/Request/Name}'}}",
    detail: 'XPath',
    documentation: `Extract a value from SOAP XML (with namespace awareness). ${TRANSFORMER_NOTE}`
  },

  // Faker Data
  {
    label: 'Faker: firstName',
    insertText: "{{randomValue type='FAKER' expression='name.firstName'}}",
    detail: 'Faker Data',
    documentation: `Generate a random first name. ${TRANSFORMER_NOTE}`
  },
  {
    label: 'Faker: lastName',
    insertText: "{{randomValue type='FAKER' expression='name.lastName'}}",
    detail: 'Faker Data',
    documentation: `Generate a random last name. ${TRANSFORMER_NOTE}`
  },
  {
    label: 'Faker: emailAddress',
    insertText: "{{randomValue type='FAKER' expression='internet.emailAddress'}}",
    detail: 'Faker Data',
    documentation: `Generate a random email address. ${TRANSFORMER_NOTE}`
  },
  {
    label: 'Faker: city',
    insertText: "{{randomValue type='FAKER' expression='address.city'}}",
    detail: 'Faker Data',
    documentation: `Generate a random city name. ${TRANSFORMER_NOTE}`
  },
  {
    label: 'Faker: phoneNumber',
    insertText: "{{randomValue type='FAKER' expression='phone.phoneNumber'}}",
    detail: 'Faker Data',
    documentation: `Generate a random phone number. ${TRANSFORMER_NOTE}`
  },
  {
    label: 'Faker: companyName',
    insertText: "{{randomValue type='FAKER' expression='company.name'}}",
    detail: 'Faker Data',
    documentation: `Generate a random company name. ${TRANSFORMER_NOTE}`
  },
  {
    label: 'Faker: custom',
    insertText: "{{randomValue type='FAKER' expression='${1:name.firstName}'}}",
    detail: 'Faker Data',
    documentation: `Generate fake data using a custom Faker expression. ${TRANSFORMER_NOTE}`
  },

  // Response helpers
  {
    label: 'hostname',
    insertText: '{{hostname}}',
    detail: 'Response Helpers',
    documentation: `The hostname of the WireMock server. ${TRANSFORMER_NOTE}`
  },
  {
    label: 'request.id',
    insertText: '{{request.id}}',
    detail: 'Response Helpers',
    documentation: `The unique ID of the current request. ${TRANSFORMER_NOTE}`
  }
];

let registered = false;

export function registerWiremockTemplateCompletions(monaco: typeof import('monaco-editor')): void {
  if (registered) return;
  registered = true;

  monaco.languages.registerCompletionItemProvider('json', {
    triggerCharacters: ['{'],
    provideCompletionItems(
      model: Monaco.editor.ITextModel,
      position: Monaco.Position
    ): Monaco.languages.ProviderResult<Monaco.languages.CompletionList> {
      const lineContent = model.getLineContent(position.lineNumber);
      const textBeforeCursor = lineContent.substring(0, position.column - 1);

      // Only trigger when user types '{{' pattern
      if (!textBeforeCursor.endsWith('{{') && !textBeforeCursor.includes('{{')) {
        return { suggestions: [] };
      }

      // Find the start of the '{{' to determine replacement range
      const lastDoubleBrace = textBeforeCursor.lastIndexOf('{{');
      if (lastDoubleBrace === -1) {
        return { suggestions: [] };
      }

      const range: Monaco.IRange = {
        startLineNumber: position.lineNumber,
        startColumn: lastDoubleBrace + 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column
      };

      const suggestions: Monaco.languages.CompletionItem[] = templateItems.map((item, index) => ({
        label: item.label,
        kind: monaco.languages.CompletionItemKind.Snippet,
        insertText: item.insertText,
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        detail: item.detail,
        documentation: item.documentation,
        range,
        sortText: String(index).padStart(3, '0')
      }));

      return { suggestions };
    }
  });
}
