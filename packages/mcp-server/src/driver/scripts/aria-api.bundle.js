(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
	typeof define === 'function' && define.amd ? define(['exports'], factory) :
	(global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.aria = {}));
})(this, (function (exports) { 'use strict';

	// https://www.w3.org/TR/wai-aria/#state_prop_def
	const attributes = {
		'activedescendant': 'id',
		'atomic': 'bool',
		'autocomplete': 'token',
		'braillelabel': 'string',
		'brailleroledescription': 'string',
		'busy': 'bool',
		'checked': 'tristate',
		'colcount': 'int',
		'colindex': 'int',
		'colindextext': 'string',
		'colspan': 'int',
		'controls': 'id-list',
		'current': 'token',
		'describedby': 'id-list',
		'description': 'string',
		'details': 'id',
		'disabled': 'bool',
		'dropeffect': 'token-list',
		'errormessage': 'id',
		'expanded': 'bool-undefined',
		'flowto': 'id-list',
		'grabbed': 'bool-undefined',
		'haspopup': 'token',
		'hidden': 'bool-undefined',
		'invalid': 'token',
		'keyshortcuts': 'string',
		'label': 'string',
		'labelledby': 'id-list',
		'level': 'int',
		'live': 'token',
		'modal': 'bool',
		'multiline': 'bool',
		'multiselectable': 'bool',
		'orientation': 'token',
		'owns': 'id-list',
		'placeholder': 'string',
		'posinset': 'int',
		'pressed': 'tristate',
		'readonly': 'bool',
		'relevant': 'token-list',
		'required': 'bool',
		'roledescription': 'string',
		'rowcount': 'int',
		'rowindex': 'int',
		'rowindextext': 'string',
		'rowspan': 'int',
		'selected': 'bool-undefined',
		'setsize': 'int',
		'sort': 'token',
		'valuemax': 'number',
		'valuemin': 'number',
		'valuenow': 'number',
		'valuetext': 'string',
	};

	const attributeStrongMapping = {
		'disabled': 'disabled',
		'placeholder': 'placeholder',
		'readonly': 'readOnly',
		'required': 'required',
	};

	const attributeWeakMapping = {
		'checked': 'checked',
		'colspan': 'colSpan',
		'expanded': 'open',
		'multiselectable': 'multiple',
		'rowspan': 'rowSpan',
		'selected': 'selected',
	};

	// https://www.w3.org/TR/html/dom.html#sectioning-content-2
	const scoped = ['article *', 'aside *', 'nav *', 'section *'].join(',');

	const svgSelectors = function(selector) {
		return [
			// `${selector}:has(> title:not(:empty))`,
			// `${selector}:has(> desc:not(:empty))`,
			`${selector}[aria-label]`,
			`${selector}[aria-roledescription]`,
			`${selector}[aria-labelledby]`,
			`${selector}[aria-describedby]`,
			`${selector}[tabindex]`,
			`${selector}[role]`,
		];
	};

	// https://www.w3.org/TR/html-aam-1.0/#html-element-role-mappings
	// https://www.w3.org/TR/wai-aria/roles
	const roles = {
		alert: {
			childRoles: ['alertdialog'],
			defaults: {
				'live': 'assertive',
				'atomic': true,
			},
		},
		alertdialog: {},
		application: {},
		article: {
			selectors: ['article'],
			childRoles: ['comment'],
		},
		banner: {
			selectors: [`header:not(main *, ${scoped})`],
		},
		blockquote: {
			selectors: ['blockquote'],
		},
		button: {
			selectors: [
				'button',
				'input[type="button"]',
				'input[type="image"]',
				'input[type="reset"]',
				'input[type="submit"]',
				'summary',
			],
			nameFromContents: true,
		},
		caption: {
			selectors: ['caption', 'figcaption'],
		},
		cell: {
			selectors: ['td', 'td ~ th:not([scope])'],
			childRoles: ['columnheader', 'gridcell', 'rowheader'],
			nameFromContents: true,
		},
		checkbox: {
			selectors: ['input[type="checkbox"]'],
			childRoles: ['switch'],
			nameFromContents: true,
			defaults: {
				'checked': 'false',
			},
		},
		code: {
			selectors: ['code'],
		},
		columnheader: {
			selectors: ['th[scope="col"]'],
			nameFromContents: true,
		},
		combobox: {
			selectors: [
				'input:not([type])[list]',
				'input[type="email"][list]',
				'input[type="search"][list]',
				'input[type="tel"][list]',
				'input[type="text"][list]',
				'input[type="url"][list]',
				'select:not([size]):not([multiple])',
				'select[size="0"]:not([multiple])',
				'select[size="1"]:not([multiple])',
			],
			defaults: {
				'expanded': false,
				'haspopup': 'listbox',
			},
		},
		command: {
			abstract: true,
			childRoles: ['button', 'link', 'menuitem'],
		},
		comment: {
			nameFromContents: true,
		},
		complementary: {
			selectors: [
				`aside:not(${scoped})`,
				'aside[aria-label]',
				'aside[aria-labelledby]',
				'aside[title]',
			],
		},
		composite: {
			abstract: true,
			childRoles: ['grid', 'select', 'spinbutton', 'tablist'],
		},
		contentinfo: {
			selectors: [`footer:not(main *, ${scoped})`],
		},
		definition: {
			selectors: ['dd'],
		},
		deletion: {
			selectors: ['del', 's'],
		},
		dialog: {
			selectors: ['dialog'],
			childRoles: ['alertdialog'],
		},
		'doc-abstract': {},
		'doc-acknowledgments': {},
		'doc-afterword': {},
		'doc-appendix': {},
		'doc-backlink': {
			nameFromContents: true,
		},
		'doc-biblioentry': {},
		'doc-bibliography': {},
		'doc-biblioref': {
			nameFromContents: true,
		},
		'doc-chapter': {},
		'doc-colophon': {},
		'doc-conclusion': {},
		'doc-cover': {},
		'doc-credit': {},
		'doc-credits': {},
		'doc-dedication': {},
		'doc-endnote': {},
		'doc-endnotes': {},
		'doc-epilogue': {},
		'doc-epigraph': {},
		'doc-errata': {},
		'doc-example': {},
		'doc-footnote': {},
		'doc-foreword': {},
		'doc-glossary': {},
		'doc-glossref': {
			nameFromContents: true,
		},
		'doc-index': {},
		'doc-introduction': {},
		'doc-noteref': {
			nameFromContents: true,
		},
		'doc-notice': {},
		'doc-pagebreak': {
			nameFromContents: true,
		},
		'doc-pagefooter': {},
		'doc-pageheader': {},
		'doc-pagelist': {},
		'doc-part': {},
		'doc-preface': {},
		'doc-prologue': {},
		'doc-pullquote': {},
		'doc-qna': {},
		'doc-subtitle': {
			nameFromContents: true,
		},
		'doc-tip': {},
		'doc-toc': {},
		document: {
			selectors: ['html'],
			childRoles: ['article', 'graphics-document'],
		},
		emphasis: {
			selectors: ['em'],
		},
		feed: {},
		figure: {
			selectors: ['figure'],
			childRoles: ['doc-example'],
		},
		form: {
			selectors: ['form[aria-label]', 'form[aria-labelledby]', 'form[title]'],
		},
		generic: {
			selectors: [
				'a:not([*|href])',
				'area:not([*|href])',
				`aside:not(${scoped}):not([aria-label]):not([aria-labelledby]):not([title])`,
				'b',
				'bdi',
				'bdo',
				'body',
				'data',
				'div',
				// footer scoped
				// header scoped
				'i',
				'li:not(ul > li):not(ol > li)',
				'pre',
				'q',
				'samp',
				'section:not([aria-label]):not([aria-labelledby]):not([title])',
				'small',
				'span',
				'u',
			],
		},
		'graphics-document': {
			selectors: ['svg'],
		},
		'graphics-object': {
			selectors: [
				...svgSelectors('symbol'),
				...svgSelectors('use'),
			],
		},
		'graphics-symbol': {
			selectors: [
				...svgSelectors('circle'),
				...svgSelectors('ellipse'),
				...svgSelectors('line'),
				...svgSelectors('path'),
				...svgSelectors('polygon'),
				...svgSelectors('polyline'),
				...svgSelectors('rect'),
			],
		},
		grid: {
			childRoles: ['treegrid'],
		},
		gridcell: {
			childRoles: ['columnheader', 'rowheader'],
			nameFromContents: true,
		},
		group: {
			selectors: [
				'address',
				'details',
				'fieldset',
				'hgroup',
				'optgroup',
				...svgSelectors('foreignObject'),
				...svgSelectors('g'),
				'text',
				...svgSelectors('textPath'),
				...svgSelectors('tspan'),
			],
			childRoles: ['row', 'select', 'toolbar', 'graphics-object'],
		},
		heading: {
			selectors: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
			nameFromContents: true,
			defaults: {
				'level': 2,
			},
		},
		image: {
			selectors: [
				'img:not([alt=""])',
				'graphics-symbol',
				...svgSelectors('image'),
				...svgSelectors('mesh'),
			],
			childRoles: ['doc-cover'],
		},
		input: {
			abstract: true,
			childRoles: [
				'checkbox',
				'combobox',
				'option',
				'radio',
				'slider',
				'spinbutton',
				'textbox',
			],
		},
		insertion: {
			selectors: ['ins'],
		},
		landmark: {
			abstract: true,
			childRoles: [
				'banner',
				'complementary',
				'contentinfo',
				'doc-acknowledgments',
				'doc-afterword',
				'doc-appendix',
				'doc-bibliography',
				'doc-chapter',
				'doc-conclusion',
				'doc-credits',
				'doc-endnotes',
				'doc-epilogue',
				'doc-errata',
				'doc-foreword',
				'doc-glossary',
				'doc-introduction',
				'doc-part',
				'doc-preface',
				'doc-prologue',
				'form',
				'main',
				'navigation',
				'region',
				'search',
			],
		},
		link: {
			selectors: ['a[*|href]', 'area[*|href]'],
			childRoles: ['doc-backlink', 'doc-biblioref', 'doc-glossref', 'doc-noteref'],
			nameFromContents: true,
		},
		list: {
			selectors: ['dl', 'ol', 'ul', 'menu'],
			childRoles: ['feed'],
		},
		listbox: {
			selectors: [
				'datalist',
				'select[multiple]',
				'select[size]:not([size="0"]):not([size="1"])',
			],
			defaults: {
				'orientation': 'vertical',
			},
		},
		listitem: {
			selectors: ['ol > li', 'ul > li'],
			childRoles: ['doc-biblioentry', 'doc-endnote', 'treeitem'],
		},
		log: {
			defaults: {
				'live': 'polite',
			},
		},
		main: {
			selectors: ['main'],
		},
		mark: {
			selectors: ['mark'],
		},
		marquee: {},
		math: {
			selectors: ['math'],
		},
		meter: {
			selectors: ['meter'],
			defaults: {
				'valuemin': 0,
				'valuemax': 100,
			},
		},
		menu: {
			childRoles: ['menubar'],
			defaults: {
				'orientation': 'vertical',
			},
		},
		menubar: {
			defaults: {
				'orientation': 'horizontal',
			},
		},
		menuitem: {
			childRoles: ['menuitemcheckbox', 'menuitemradio'],
			nameFromContents: true,
		},
		menuitemcheckbox: {
			nameFromContents: true,
			defaults: {
				'checked': 'false',
			},
		},
		menuitemradio: {
			nameFromContents: true,
			defaults: {
				'checked': 'false',
			},
		},
		navigation: {
			selectors: ['nav'],
			childRoles: ['doc-index', 'doc-pagelist', 'doc-toc'],
		},
		none: {
			selectors: ['img[alt=""]'],
		},
		note: {
			childRoles: ['doc-notice', 'doc-tip'],
		},
		option: {
			selectors: ['option'],
			childRoles: ['treeitem'],
			nameFromContents: true,
			defaults: {
				'selected': 'false',
			},
		},
		paragraph: {
			selectors: ['p'],
		},
		progressbar: {
			selectors: ['progress'],
			defaults: {
				'valuemin': 0,
				'valuemax': 100,
			},
		},
		radio: {
			selectors: ['input[type="radio"]'],
			childRoles: ['menuitemradio'],
			nameFromContents: true,
			defaults: {
				'checked': 'false',
			},
		},
		radiogroup: {},
		range: {
			abstract: true,
			childRoles: ['meter', 'progressbar', 'scrollbar', 'slider', 'spinbutton'],
		},
		region: {
			selectors: ['section[aria-label]', 'section[aria-labelledby]', 'section[title]'],
		},
		roletype: {
			abstract: true,
			childRoles: ['structure', 'widget', 'window'],
		},
		row: {
			selectors: ['tr'],
			nameFromContents: true,
		},
		rowgroup: {
			selectors: ['tbody', 'thead', 'tfoot'],
		},
		rowheader: {
			selectors: ['th[scope="row"]', 'th:not([scope]):not(td ~ th)'],
			nameFromContents: true,
		},
		scrollbar: {
			defaults: {
				'orientation': 'vertical',
				'valuemin': 0,
				'valuemax': 100,
			},
		},
		search: {
			selectors: ['search'],
		},
		searchbox: {
			selectors: ['input[type="search"]:not([list])'],
		},
		section: {
			abstract: true,
			childRoles: [
				'alert',
				'blockquote',
				'caption',
				'cell',
				'code',
				'definition',
				'deletion',
				'doc-abstract',
				'doc-colophon',
				'doc-credit',
				'doc-dedication',
				'doc-epigraph',
				'doc-footnote',
				'doc-pagefooter',
				'doc-pageheader',
				'doc-pullquote',
				'doc-qna',
				'emphasis',
				'figure',
				'group',
				'image',
				'insertion',
				'landmark',
				'list',
				'listitem',
				'log',
				'mark',
				'marquee',
				'math',
				'note',
				'paragraph',
				'status',
				'strong',
				'subscript',
				'suggestion',
				'superscript',
				'table',
				'tabpanel',
				'term',
				'time',
				'tooltip',
			],
		},
		sectionhead: {
			abstract: true,
			childRoles: [
				'columnheader',
				'doc-subtitle',
				'heading',
				'rowheader',
				'tab',
			],
			nameFromContents: true,
		},
		select: {
			abstract: true,
			childRoles: ['listbox', 'menu', 'radiogroup', 'tree'],
		},
		separator: {
			// assume not focussable because <hr> is not
			selectors: ['hr'],
			childRoles: ['doc-pagebreak'],
			defaults: {
				'orientation': 'horizontal',
				'valuemin': 0,
				'valuemax': 100,
			},
		},
		slider: {
			selectors: ['input[type="range"]'],
			defaults: {
				'orientation': 'horizontal',
				'valuemin': 0,
				'valuemax': 100,
				// FIXME: halfway between actual valuemin and valuemax
				'valuenow': 50,
			},
		},
		spinbutton: {
			selectors: ['input[type="number"]'],
			defaults: {
				// FIXME: no valuemin/valuemax/valuenow
			},
		},
		status: {
			selectors: ['output'],
			childRoles: ['timer'],
			defaults: {
				'live': 'polite',
				'atomic': true,
			},
		},
		strong: {
			selectors: ['strong'],
		},
		structure: {
			abstract: true,
			childRoles: [
				'application',
				'document',
				'none',
				'generic',
				'range',
				'rowgroup',
				'section',
				'sectionhead',
				'separator',
			],
		},
		suggestion: {},
		subscript: {
			selectors: ['sub'],
		},
		superscript: {
			selectors: ['sup'],
		},
		switch: {
			nameFromContents: true,
			defaults: {
				'checked': false,
			},
		},
		tab: {
			nameFromContents: true,
			defaults: {
				'selected': false,
			},
		},
		table: {
			selectors: ['table'],
			childRoles: ['grid'],
		},
		tablist: {
			defaults: {
				'orientation': 'horizontal',
			},
		},
		tabpanel: {},
		term: {
			selectors: ['dfn', 'dt'],
		},
		textbox: {
			selectors: [
				'input:not([type]):not([list])',
				'input[type="email"]:not([list])',
				'input[type="tel"]:not([list])',
				'input[type="text"]:not([list])',
				'input[type="url"]:not([list])',
				'textarea',
			],
			childRoles: ['searchbox'],
		},
		time: {
			selectors: ['time'],
		},
		timer: {
			defaults: {
				'live': 'off',
			},
		},
		toolbar: {
			defaults: {
				'orientation': 'horizontal',
			},
		},
		tooltip: {
			nameFromContents: true,
		},
		tree: {
			childRoles: ['treegrid'],
			defaults: {
				'orientation': 'vertical',
			},
		},
		treegrid: {},
		treeitem: {
			nameFromContents: true,
		},
		widget: {
			abstract: true,
			childRoles: [
				'command',
				'composite',
				'gridcell',
				'input',
				'progressbar',
				'row',
				'scrollbar',
				'separator',
				'tab',
			],
		},
		window: {
			abstract: true,
			childRoles: ['dialog'],
		},
	};

	const getSubRoles = function(role) {
		const children = (roles[role]).childRoles || [];
		const descendents = children.map(getSubRoles);

		const result = [role];

		descendents.forEach(list => {
			list.forEach(r => {
				if (!result.includes(r)) {
					result.push(r);
				}
			});
		});

		return result;
	};

	const attrsWithDefaults = [];

	for (const role in roles) {
		roles[role].subRoles = getSubRoles(role);
		for (const key in roles[role].defaults) {
			if (!attrsWithDefaults.includes(key)) {
				attrsWithDefaults.push(key);
			}
		}
	}

	const aliases = {
		'presentation': 'none',
		'directory': 'list',
		'img': 'image',
	};

	const nameFromDescendant = {
		'figure': 'figcaption',
		'table': 'caption',
		'fieldset': 'legend',
	};

	const nameDefaults = {
		'input[type="submit"]': 'Submit',
		'input[type="reset"]': 'Reset',
		'summary': 'Details',
	};

	var unique = function(arr) {
		return arr.filter((a, i) => arr.indexOf(a) === i);
	};

	var flatten = function(arr) {
		return [].concat.apply([], arr);
	};

	var normalizeRoles = function(roles$1, includeAbstract) {
		return unique(roles$1
			.map(r => aliases[r] || r)
			.filter(r => roles[r])
			.filter(r => includeAbstract || !roles[r].abstract)
		);
	};

	// candidates can be passed for performance optimization
	const getRoleRaw = function(el, candidates) {
		// TODO: filter out any invalid roles (e.g. name or context required)
		const roles$1 = normalizeRoles(
			(el.getAttribute('role') || '').toLowerCase().split(/\s+/)
		);

		if (roles$1.length > 1 && candidates) {
			return [roles$1, candidates];
		} else if (roles$1.length) {
			for (const role of roles$1) {
				if (!candidates || candidates.includes(role)) {
					return role;
				}
			}
		} else {
			for (const role of (candidates || Object.keys(roles))) {
				const r = roles[role];
				if (!r.abstract && r.selectors && el.matches(r.selectors.join(','))) {
					return role;
				}
			}
		}
	};

	const getRole = function(el) {
		return getRoleRaw(el);
	};

	const hasRole = function(el, roles$1) {
		const subRoles = normalizeRoles(roles$1, true).map(role => {
			return roles[role].subRoles || [role];
		});
		return !!getRoleRaw(el, unique(flatten(subRoles)));
	};

	const getAttribute = function(el, key) {
		if (attributeStrongMapping.hasOwnProperty(key)) {
			const value = el[attributeStrongMapping[key]];
			if (value) {
				return value;
			}
		}
		if (key === 'readonly' && el.contentEditable) {
			return false;
		} else if (key === 'invalid' && el.checkValidity) {
			return !el.checkValidity();
		} else if (key === 'hidden') {
			// workaround for chromium
			if (el.matches('noscript')) {
				return true;
			}
			if (el.matches('details:not([open]) > :not(summary)')) {
				return true;
			}
			const style = window.getComputedStyle(el);
			if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') {
				return true;
			}
		}

		const type = attributes[key];
		const raw = el.getAttribute('aria-' + key);

		if (raw) {
			if (type === 'bool') {
				return raw === 'true';
			} else if (type === 'tristate') {
				return raw === 'true' ? true : raw === 'false' ? false : 'mixed';
			} else if (type === 'bool-undefined') {
				return raw === 'true' ? true : raw === 'false' ? false : undefined;
			} else if (type === 'id-list') {
				return raw.split(/\s+/);
			} else if (type === 'integer') {
				return parseInt(raw, 10);
			} else if (type === 'number') {
				return parseFloat(raw);
			} else if (type === 'token-list') {
				return raw.split(/\s+/);
			} else {
				return raw;
			}
		}

		// TODO
		// autocomplete
		// contextmenu -> aria-haspopup
		// indeterminate -> aria-checked="mixed"
		// list -> aria-controls

		if (key === 'level') {
			for (let i = 1; i <= 6; i++) {
				if (el.tagName.toLowerCase() === 'h' + i) {
					return i;
				}
			}
		} else if (attributeWeakMapping.hasOwnProperty(key)) {
			return el[attributeWeakMapping[key]];
		}

		if (key in attrsWithDefaults) {
			const role = getRole(el);
			const defaults = roles[role].defaults;
			if (defaults && defaults.hasOwnProperty(key)) {
				return defaults[key];
			}
		}

		if (type === 'bool' || type === 'tristate') {
			return false;
		}
	};

	const _getOwner = function(node, owners) {
		if (node.nodeType === node.ELEMENT_NODE && node.id) {
			const selector = '[aria-owns~="' + CSS.escape(node.id) + '"]';
			if (owners) {
				for (const owner of owners) {
					if (owner.matches(selector)) {
						return owner;
					}
				}
			} else {
				return document.querySelector(selector);
			}
		}
	};

	const _getParentNode = function(node, owners) {
		return _getOwner(node, owners) || node.parentNode;
	};

	const detectLoop = function(node, owners) {
		const seen = [node];
		while ((node = _getParentNode(node, owners))) {
			if (seen.includes(node)) {
				return true;
			}
			seen.push(node);
		}
	};

	const getOwner = function(node, owners) {
		const owner = _getOwner(node, owners);
		if (owner && !detectLoop(node, owners)) {
			return owner;
		}
	};

	const getParentNode = function(node, owners) {
		return getOwner(node, owners) || node.parentNode;
	};

	const isHidden = function(node) {
		return node.nodeType === node.ELEMENT_NODE && getAttribute(node, 'hidden');
	};

	const getChildNodes = function(node, owners) {
		const childNodes = [];

		for (let i = 0; i < node.childNodes.length; i++) {
			const child = node.childNodes[i];
			if (!getOwner(child, owners) && !isHidden(child)) {
				childNodes.push(child);
			}
		}

		if (node.nodeType === node.ELEMENT_NODE) {
			const owns = getAttribute(node, 'owns') || [];
			for (let i = 0; i < owns.length; i++) {
				const child = document.getElementById(owns[i]);
				// double check with getOwner for consistency
				if (child && getOwner(child, owners) === node && !isHidden(child)) {
					childNodes.push(child);
				}
			}
		}

		return childNodes;
	};

	const walk = function(root, fn) {
		const owners = document.querySelectorAll('[aria-owns]');
		let queue = [root];
		while (queue.length) {
			const item = queue.shift();
			fn(item);
			queue = getChildNodes(item, owners).concat(queue);
		}
	};

	const searchUp = function(node, test) {
		const candidate = getParentNode(node);
		if (candidate) {
			if (test(candidate)) {
				return candidate;
			} else {
				return searchUp(candidate, test);
			}
		}
	};

	const matches = function(el, selector) {
		if (selector.substr(0, 1) === ':') {
			const attr = selector.substr(1);
			return getAttribute(el, attr);
		} else if (selector.substr(0, 1) === '[') {
			const match = /\[([a-z]+)="(.*)"\]/.exec(selector);
			const actual = getAttribute(el, match[1]);
			const rawValue = match[2];
			return actual.toString() === rawValue;
		} else {
			return hasRole(el, selector.split(','));
		}
	};

	const _querySelector = function(all) {
		return function(root, selector) {
			const results = [];
			try {
				walk(root, node => {
					if (node.nodeType === node.ELEMENT_NODE) {
						// FIXME: skip hidden elements
						if (matches(node, selector)) {
							results.push(node);
							if (!all) {
								throw 'StopIteration';
							}
						}
					}
				});
			} catch (e) {
				if (e !== 'StopIteration') {
					throw e;
				}
			}
			return all ? results : results[0];
		};
	};

	const closest = function(el, selector) {
		return searchUp(el, candidate => {
			if (candidate.nodeType === candidate.ELEMENT_NODE) {
				return matches(candidate, selector);
			}
		});
	};

	const querySelector = _querySelector();
	const querySelectorAll = _querySelector(true);

	const addSpaces = function(text, el, pseudoSelector) {
		// https://github.com/w3c/accname/issues/3
		const styles = window.getComputedStyle(el, pseudoSelector);
		const inline = styles.display === 'inline';
		return inline ? text : ` ${text} `;
	};

	const getPseudoContent = function(el, pseudoSelector) {
		const styles = window.getComputedStyle(el, pseudoSelector);
		let tail = styles.getPropertyValue('content').trim();
		let ret = [];

		let match;
		while (tail.length) {
			if ((match = tail.match(/^"([^"]*)"/))) {
				ret.push(match[1]);
			} else if ((match = tail.match(/^([a-z-]+)\(([^)]*)\)/))) {
				if (match[1] === 'attr') {
					ret.push(el.getAttribute(match[2]) || '');
				}
			} else if ((match = tail.match(/^([a-z-]+)/))) {
				if (match[1] === 'open-quote' || match[1] === 'close-quote') {
					ret.push('"');
				}
			} else if ((match = tail.match(/^\//))) {
				ret = [];
			} else {
				// invalid content, ignore
				return '';
			}
			tail = tail.slice(match[0].length).trim();
		}

		return addSpaces(ret.join(''), el, pseudoSelector);
	};

	const getContent = function(root, ongoingLabelledBy, visited) {
		const children = getChildNodes(root);

		let ret = '';
		for (let i = 0; i < children.length; i++) {
			const node = children[i];
			if (node.nodeType === node.TEXT_NODE) {
				const styles = window.getComputedStyle(node.parentElement);
				if (styles.textTransform === 'uppercase') {
					ret += node.textContent.toUpperCase();
				} else if (styles.textTransform === 'lowercase') {
					ret += node.textContent.toLowerCase();
				} else if (styles.textTransform === 'capitalize') {
					ret += node.textContent.replace(/\b\w/g, c => c.toUpperCase());
				} else {
					ret += node.textContent;
				}
			} else if (node.nodeType === node.ELEMENT_NODE) {
				if (node.tagName.toLowerCase() === 'br') {
					ret += '\n';
				} else {
					ret += getNameRaw(node, true, ongoingLabelledBy, visited);
				}
			}
		}

		return ret;
	};

	const allowNameFromContent = function(el) {
		const role = getRole(el);
		if (role) {
			return roles[role].nameFromContents;
		}
	};

	const getNameRaw = function(el, recursive, ongoingLabelledBy, visited, directReference) {
		let ret = '';

		visited = visited || [];
		if (visited.includes(el)) {
			if (!directReference) {
				return '';
			}
		} else {
			visited.push(el);
		}

		// A
		// handled in atree

		// B
		if (!ongoingLabelledBy && el.matches('[aria-labelledby]')) {
			const ids = el.getAttribute('aria-labelledby').split(/\s+/);
			const strings = ids.map(id => {
				const label = document.getElementById(id);
				return label ? getNameRaw(label, true, true, visited, true) : '';
			});
			ret = strings.join(' ');
		}

		// E (the current draft has this at this high priority)
		if (!ret.trim() && recursive) {
			if (matches(el, 'textbox')) {
				ret = el.value || el.textContent;
			} else if (matches(el, 'combobox,listbox')) {
				const selected = querySelector(el, ':selected') || querySelector(el, 'option');
				if (selected) {
					ret = getNameRaw(selected, recursive, ongoingLabelledBy, visited);
				} else {
					ret = el.value || '';
				}
			} else if (matches(el, 'range')) {
				ret = '' + (getAttribute(el, 'valuetext') || getAttribute(el, 'valuenow') || el.value);
			}
		}

		// C
		if (!ret.trim() && el.matches('[aria-label]')) {
			// FIXME: may skip to 2E
			ret = el.getAttribute('aria-label');
		}

		// D
		if (!ret.trim() && !recursive && el.labels) {
			const strings = Array.prototype.map.call(el.labels, label => {
				return getNameRaw(label, true, ongoingLabelledBy, visited);
			});
			ret = strings.join(' ');
		}
		if (!ret.trim()) {
			ret = el.alt || '';
		}
		if (!ret.trim() && el.matches('abbr,acronym') && el.title) {
			ret = el.title;
		}
		if (!ret.trim()) {
			for (const selector in nameFromDescendant) {
				if (el.matches(selector)) {
					const descendant = el.querySelector(nameFromDescendant[selector]);
					if (descendant) {
						ret = getNameRaw(descendant, true, ongoingLabelledBy, visited);
					}
				}
			}
		}
		if (!ret.trim() && el.matches('svg *')) {
			const svgTitle = el.querySelector('title');
			if (svgTitle && svgTitle.parentElement === el) {
				ret = svgTitle.textContent;
			}
		}
		if (!ret.trim() && el.matches('a')) {
			ret = el.getAttribute('xlink:title') || '';
		}

		// F
		// FIXME: menu is not mentioned in the spec
		if (!ret.trim() && (recursive || allowNameFromContent(el) || el.closest('label')) && !matches(el, 'menu')) {
			ret = getContent(el, ongoingLabelledBy, visited);
		}

		if (!ret.trim() && matches(el, 'button')) {
			ret = el.value || '';
		}

		if (!ret.trim()) {
			for (const selector in nameDefaults) {
				if (el.matches(selector)) {
					ret = nameDefaults[selector];
				}
			}
		}

		// G/H
		// handled in getContent

		// I
		if (!ret.trim()) {
			ret = el.title || el.placeholder || '';
		}

		// FIXME: not exactly sure about this, but it reduces the number of failing
		// WPT tests. Whitespace is hard.
		if (!ret.trim()) {
			ret = ' ';
		}

		const before = getPseudoContent(el, ':before');
		const after = getPseudoContent(el, ':after');
		return addSpaces(before + ret + after, el);
	};

	const getName = function(el) {
		return getNameRaw(el)
			.replace(/[ \n\r\t\f]+/g, ' ')
			.replace(/^ /, '')
			.replace(/ $/, '');
	};

	const getDescription = function(el) {
		let ret = '';

		if (el.matches('[aria-describedby]')) {
			const ids = el.getAttribute('aria-describedby').split(/\s+/);
			const strings = ids.map(id => {
				const label = document.getElementById(id);
				return label ? getNameRaw(label, true, true) : '';
			});
			ret = strings.join(' ');
		} else if (el.matches('[aria-description]')) {
			ret = el.getAttribute('aria-description');
		} else if (el.matches('svg *')) {
			const svgDesc = el.querySelector('desc');
			if (svgDesc && svgDesc.parentElement === el) {
				ret = svgDesc.textContent;
			}
		} else if (el.title) {
			ret = el.title;
		}
		if (!ret.trim() && el.matches('a')) {
			ret = el.getAttribute('xlink:title') || '';
		}

		ret = (ret || '').trim().replace(/\s+/g, ' ');

		if (ret === getName(el)) {
			ret = '';
		}

		return ret;
	};

	exports.closest = closest;
	exports.getAttribute = getAttribute;
	exports.getChildNodes = getChildNodes;
	exports.getDescription = getDescription;
	exports.getName = getName;
	exports.getParentNode = getParentNode;
	exports.getRole = getRole;
	exports.matches = matches;
	exports.querySelector = querySelector;
	exports.querySelectorAll = querySelectorAll;

}));

window.ariaApi = window.aria;