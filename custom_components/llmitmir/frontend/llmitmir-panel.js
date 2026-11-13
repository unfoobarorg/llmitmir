var R0=Object.defineProperty;var b6=Object.getOwnPropertyDescriptor;var k6=(r,V,C)=>V in r?R0(r,V,{enumerable:!0,configurable:!0,writable:!0,value:C}):r[V]=C;var y6=(r,V)=>{for(var C in V)R0(r,C,{get:V[C],enumerable:!0})};var h=(r,V,C,H)=>{for(var e=H>1?void 0:H?b6(V,C):V,L=r.length-1,i;L>=0;L--)(i=r[L])&&(e=(H?i(V,C,e):i(e))||e);return H&&e&&R0(V,C,e),e};var W=(r,V,C)=>k6(r,typeof V!="symbol"?V+"":V,C);var B5=globalThis,_5=B5.ShadowRoot&&(B5.ShadyCSS===void 0||B5.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,F0=Symbol(),i4=new WeakMap,q2=class{constructor(V,C,H){if(this._$cssResult$=!0,H!==F0)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=V,this.t=C}get styleSheet(){let V=this.o,C=this.t;if(_5&&V===void 0){let H=C!==void 0&&C.length===1;H&&(V=i4.get(C)),V===void 0&&((this.o=V=new CSSStyleSheet).replaceSync(this.cssText),H&&i4.set(C,V))}return V}toString(){return this.cssText}},M4=r=>new q2(typeof r=="string"?r:r+"",void 0,F0),B=(r,...V)=>{let C=r.length===1?r[0]:V.reduce((H,e,L)=>H+(i=>{if(i._$cssResult$===!0)return i.cssText;if(typeof i=="number")return i;throw Error("Value passed to 'css' function must be a 'css' function result: "+i+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(e)+r[L+1],r[0]);return new q2(C,r,F0)},a4=(r,V)=>{if(_5)r.adoptedStyleSheets=V.map(C=>C instanceof CSSStyleSheet?C:C.styleSheet);else for(let C of V){let H=document.createElement("style"),e=B5.litNonce;e!==void 0&&H.setAttribute("nonce",e),H.textContent=C.cssText,r.appendChild(H)}},D0=_5?r=>r:r=>r instanceof CSSStyleSheet?(V=>{let C="";for(let H of V.cssRules)C+=H.cssText;return M4(C)})(r):r;var{is:w6,defineProperty:O6,getOwnPropertyDescriptor:$6,getOwnPropertyNames:T6,getOwnPropertySymbols:P6,getPrototypeOf:B6}=Object,E5=globalThis,o4=E5.trustedTypes,_6=o4?o4.emptyScript:"",E6=E5.reactiveElementPolyfillSupport,K2=(r,V)=>r,Q2={toAttribute(r,V){switch(V){case Boolean:r=r?_6:null;break;case Object:case Array:r=r==null?r:JSON.stringify(r)}return r},fromAttribute(r,V){let C=r;switch(V){case Boolean:C=r!==null;break;case Number:C=r===null?null:Number(r);break;case Object:case Array:try{C=JSON.parse(r)}catch{C=null}}return C}},R5=(r,V)=>!w6(r,V),n4={attribute:!0,type:String,converter:Q2,reflect:!1,useDefault:!1,hasChanged:R5};Symbol.metadata??=Symbol("metadata"),E5.litPropertyMetadata??=new WeakMap;var F1=class extends HTMLElement{static addInitializer(V){this._$Ei(),(this.l??=[]).push(V)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(V,C=n4){if(C.state&&(C.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(V)&&((C=Object.create(C)).wrapped=!0),this.elementProperties.set(V,C),!C.noAccessor){let H=Symbol(),e=this.getPropertyDescriptor(V,H,C);e!==void 0&&O6(this.prototype,V,e)}}static getPropertyDescriptor(V,C,H){let{get:e,set:L}=$6(this.prototype,V)??{get(){return this[C]},set(i){this[C]=i}};return{get:e,set(i){let M=e?.call(this);L?.call(this,i),this.requestUpdate(V,M,H)},configurable:!0,enumerable:!0}}static getPropertyOptions(V){return this.elementProperties.get(V)??n4}static _$Ei(){if(this.hasOwnProperty(K2("elementProperties")))return;let V=B6(this);V.finalize(),V.l!==void 0&&(this.l=[...V.l]),this.elementProperties=new Map(V.elementProperties)}static finalize(){if(this.hasOwnProperty(K2("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(K2("properties"))){let C=this.properties,H=[...T6(C),...P6(C)];for(let e of H)this.createProperty(e,C[e])}let V=this[Symbol.metadata];if(V!==null){let C=litPropertyMetadata.get(V);if(C!==void 0)for(let[H,e]of C)this.elementProperties.set(H,e)}this._$Eh=new Map;for(let[C,H]of this.elementProperties){let e=this._$Eu(C,H);e!==void 0&&this._$Eh.set(e,C)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(V){let C=[];if(Array.isArray(V)){let H=new Set(V.flat(1/0).reverse());for(let e of H)C.unshift(D0(e))}else V!==void 0&&C.push(D0(V));return C}static _$Eu(V,C){let H=C.attribute;return H===!1?void 0:typeof H=="string"?H:typeof V=="string"?V.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){this._$ES=new Promise(V=>this.enableUpdating=V),this._$AL=new Map,this._$E_(),this.requestUpdate(),this.constructor.l?.forEach(V=>V(this))}addController(V){(this._$EO??=new Set).add(V),this.renderRoot!==void 0&&this.isConnected&&V.hostConnected?.()}removeController(V){this._$EO?.delete(V)}_$E_(){let V=new Map,C=this.constructor.elementProperties;for(let H of C.keys())this.hasOwnProperty(H)&&(V.set(H,this[H]),delete this[H]);V.size>0&&(this._$Ep=V)}createRenderRoot(){let V=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return a4(V,this.constructor.elementStyles),V}connectedCallback(){this.renderRoot??=this.createRenderRoot(),this.enableUpdating(!0),this._$EO?.forEach(V=>V.hostConnected?.())}enableUpdating(V){}disconnectedCallback(){this._$EO?.forEach(V=>V.hostDisconnected?.())}attributeChangedCallback(V,C,H){this._$AK(V,H)}_$ET(V,C){let H=this.constructor.elementProperties.get(V),e=this.constructor._$Eu(V,H);if(e!==void 0&&H.reflect===!0){let L=(H.converter?.toAttribute!==void 0?H.converter:Q2).toAttribute(C,H.type);this._$Em=V,L==null?this.removeAttribute(e):this.setAttribute(e,L),this._$Em=null}}_$AK(V,C){let H=this.constructor,e=H._$Eh.get(V);if(e!==void 0&&this._$Em!==e){let L=H.getPropertyOptions(e),i=typeof L.converter=="function"?{fromAttribute:L.converter}:L.converter?.fromAttribute!==void 0?L.converter:Q2;this._$Em=e;let M=i.fromAttribute(C,L.type);this[e]=M??this._$Ej?.get(e)??M,this._$Em=null}}requestUpdate(V,C,H,e=!1,L){if(V!==void 0){let i=this.constructor;if(e===!1&&(L=this[V]),H??=i.getPropertyOptions(V),!((H.hasChanged??R5)(L,C)||H.useDefault&&H.reflect&&L===this._$Ej?.get(V)&&!this.hasAttribute(i._$Eu(V,H))))return;this.C(V,C,H)}this.isUpdatePending===!1&&(this._$ES=this._$EP())}C(V,C,{useDefault:H,reflect:e,wrapped:L},i){H&&!(this._$Ej??=new Map).has(V)&&(this._$Ej.set(V,i??C??this[V]),L!==!0||i!==void 0)||(this._$AL.has(V)||(this.hasUpdated||H||(C=void 0),this._$AL.set(V,C)),e===!0&&this._$Em!==V&&(this._$Eq??=new Set).add(V))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(C){Promise.reject(C)}let V=this.scheduleUpdate();return V!=null&&await V,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??=this.createRenderRoot(),this._$Ep){for(let[e,L]of this._$Ep)this[e]=L;this._$Ep=void 0}let H=this.constructor.elementProperties;if(H.size>0)for(let[e,L]of H){let{wrapped:i}=L,M=this[e];i!==!0||this._$AL.has(e)||M===void 0||this.C(e,void 0,L,M)}}let V=!1,C=this._$AL;try{V=this.shouldUpdate(C),V?(this.willUpdate(C),this._$EO?.forEach(H=>H.hostUpdate?.()),this.update(C)):this._$EM()}catch(H){throw V=!1,this._$EM(),H}V&&this._$AE(C)}willUpdate(V){}_$AE(V){this._$EO?.forEach(C=>C.hostUpdated?.()),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(V)),this.updated(V)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(V){return!0}update(V){this._$Eq&&=this._$Eq.forEach(C=>this._$ET(C,this[C])),this._$EM()}updated(V){}firstUpdated(V){}};F1.elementStyles=[],F1.shadowRootOptions={mode:"open"},F1[K2("elementProperties")]=new Map,F1[K2("finalized")]=new Map,E6?.({ReactiveElement:F1}),(E5.reactiveElementVersions??=[]).push("2.1.2");var G0=globalThis,s4=r=>r,F5=G0.trustedTypes,l4=F5?F5.createPolicy("lit-html",{createHTML:r=>r}):void 0,v4="$lit$",K1=`lit$${Math.random().toFixed(9).slice(2)}$`,u4="?"+K1,R6=`<${u4}>`,M2=document,Y2=()=>M2.createComment(""),J2=r=>r===null||typeof r!="object"&&typeof r!="function",q0=Array.isArray,F6=r=>q0(r)||typeof r?.[Symbol.iterator]=="function",z0=`[ 	
\f\r]`,X2=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,d4=/-->/g,A4=/>/g,r2=RegExp(`>|${z0}(?:([^\\s"'>=/]+)(${z0}*=${z0}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`,"g"),p4=/'/g,m4=/"/g,x4=/^(?:script|style|textarea|title)$/i,K0=r=>(V,...C)=>({_$litType$:r,strings:V,values:C}),t=K0(1),h4=K0(2),TC=K0(3),D1=Symbol.for("lit-noChange"),s=Symbol.for("lit-nothing"),c4=new WeakMap,i2=M2.createTreeWalker(M2,129);function Z4(r,V){if(!q0(r)||!r.hasOwnProperty("raw"))throw Error("invalid template strings array");return l4!==void 0?l4.createHTML(V):V}var D6=(r,V)=>{let C=r.length-1,H=[],e,L=V===2?"<svg>":V===3?"<math>":"",i=X2;for(let M=0;M<C;M++){let o=r[M],l,a,m=-1,c=0;for(;c<o.length&&(i.lastIndex=c,a=i.exec(o),a!==null);)c=i.lastIndex,i===X2?a[1]==="!--"?i=d4:a[1]!==void 0?i=A4:a[2]!==void 0?(x4.test(a[2])&&(e=RegExp("</"+a[2],"g")),i=r2):a[3]!==void 0&&(i=r2):i===r2?a[0]===">"?(i=e??X2,m=-1):a[1]===void 0?m=-2:(m=i.lastIndex-a[2].length,l=a[1],i=a[3]===void 0?r2:a[3]==='"'?m4:p4):i===m4||i===p4?i=r2:i===d4||i===A4?i=X2:(i=r2,e=void 0);let u=i===r2&&r[M+1].startsWith("/>")?" ":"";L+=i===X2?o+R6:m>=0?(H.push(l),o.slice(0,m)+v4+o.slice(m)+K1+u):o+K1+(m===-2?M:u)}return[Z4(r,L+(r[C]||"<?>")+(V===2?"</svg>":V===3?"</math>":"")),H]},C5=class r{constructor({strings:V,_$litType$:C},H){let e;this.parts=[];let L=0,i=0,M=V.length-1,o=this.parts,[l,a]=D6(V,C);if(this.el=r.createElement(l,H),i2.currentNode=this.el.content,C===2||C===3){let m=this.el.content.firstChild;m.replaceWith(...m.childNodes)}for(;(e=i2.nextNode())!==null&&o.length<M;){if(e.nodeType===1){if(e.hasAttributes())for(let m of e.getAttributeNames())if(m.endsWith(v4)){let c=a[i++],u=e.getAttribute(m).split(K1),b=/([.?@])?(.*)/.exec(c);o.push({type:1,index:L,name:b[2],strings:u,ctor:b[1]==="."?I0:b[1]==="?"?W0:b[1]==="@"?j0:b2}),e.removeAttribute(m)}else m.startsWith(K1)&&(o.push({type:6,index:L}),e.removeAttribute(m));if(x4.test(e.tagName)){let m=e.textContent.split(K1),c=m.length-1;if(c>0){e.textContent=F5?F5.emptyScript:"";for(let u=0;u<c;u++)e.append(m[u],Y2()),i2.nextNode(),o.push({type:2,index:++L});e.append(m[c],Y2())}}}else if(e.nodeType===8)if(e.data===u4)o.push({type:2,index:L});else{let m=-1;for(;(m=e.data.indexOf(K1,m+1))!==-1;)o.push({type:7,index:L}),m+=K1.length-1}L++}}static createElement(V,C){let H=M2.createElement("template");return H.innerHTML=V,H}};function f2(r,V,C=r,H){if(V===D1)return V;let e=H!==void 0?C._$Co?.[H]:C._$Cl,L=J2(V)?void 0:V._$litDirective$;return e?.constructor!==L&&(e?._$AO?.(!1),L===void 0?e=void 0:(e=new L(r),e._$AT(r,C,H)),H!==void 0?(C._$Co??=[])[H]=e:C._$Cl=e),e!==void 0&&(V=f2(r,e._$AS(r,V.values),e,H)),V}var N0=class{constructor(V,C){this._$AV=[],this._$AN=void 0,this._$AD=V,this._$AM=C}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(V){let{el:{content:C},parts:H}=this._$AD,e=(V?.creationScope??M2).importNode(C,!0);i2.currentNode=e;let L=i2.nextNode(),i=0,M=0,o=H[0];for(;o!==void 0;){if(i===o.index){let l;o.type===2?l=new H5(L,L.nextSibling,this,V):o.type===1?l=new o.ctor(L,o.name,o.strings,this,V):o.type===6&&(l=new U0(L,this,V)),this._$AV.push(l),o=H[++M]}i!==o?.index&&(L=i2.nextNode(),i++)}return i2.currentNode=M2,e}p(V){let C=0;for(let H of this._$AV)H!==void 0&&(H.strings!==void 0?(H._$AI(V,H,C),C+=H.strings.length-2):H._$AI(V[C])),C++}},H5=class r{get _$AU(){return this._$AM?._$AU??this._$Cv}constructor(V,C,H,e){this.type=2,this._$AH=s,this._$AN=void 0,this._$AA=V,this._$AB=C,this._$AM=H,this.options=e,this._$Cv=e?.isConnected??!0}get parentNode(){let V=this._$AA.parentNode,C=this._$AM;return C!==void 0&&V?.nodeType===11&&(V=C.parentNode),V}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(V,C=this){V=f2(this,V,C),J2(V)?V===s||V==null||V===""?(this._$AH!==s&&this._$AR(),this._$AH=s):V!==this._$AH&&V!==D1&&this._(V):V._$litType$!==void 0?this.$(V):V.nodeType!==void 0?this.T(V):F6(V)?this.k(V):this._(V)}O(V){return this._$AA.parentNode.insertBefore(V,this._$AB)}T(V){this._$AH!==V&&(this._$AR(),this._$AH=this.O(V))}_(V){this._$AH!==s&&J2(this._$AH)?this._$AA.nextSibling.data=V:this.T(M2.createTextNode(V)),this._$AH=V}$(V){let{values:C,_$litType$:H}=V,e=typeof H=="number"?this._$AC(V):(H.el===void 0&&(H.el=C5.createElement(Z4(H.h,H.h[0]),this.options)),H);if(this._$AH?._$AD===e)this._$AH.p(C);else{let L=new N0(e,this),i=L.u(this.options);L.p(C),this.T(i),this._$AH=L}}_$AC(V){let C=c4.get(V.strings);return C===void 0&&c4.set(V.strings,C=new C5(V)),C}k(V){q0(this._$AH)||(this._$AH=[],this._$AR());let C=this._$AH,H,e=0;for(let L of V)e===C.length?C.push(H=new r(this.O(Y2()),this.O(Y2()),this,this.options)):H=C[e],H._$AI(L),e++;e<C.length&&(this._$AR(H&&H._$AB.nextSibling,e),C.length=e)}_$AR(V=this._$AA.nextSibling,C){for(this._$AP?.(!1,!0,C);V!==this._$AB;){let H=s4(V).nextSibling;s4(V).remove(),V=H}}setConnected(V){this._$AM===void 0&&(this._$Cv=V,this._$AP?.(V))}},b2=class{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(V,C,H,e,L){this.type=1,this._$AH=s,this._$AN=void 0,this.element=V,this.name=C,this._$AM=e,this.options=L,H.length>2||H[0]!==""||H[1]!==""?(this._$AH=Array(H.length-1).fill(new String),this.strings=H):this._$AH=s}_$AI(V,C=this,H,e){let L=this.strings,i=!1;if(L===void 0)V=f2(this,V,C,0),i=!J2(V)||V!==this._$AH&&V!==D1,i&&(this._$AH=V);else{let M=V,o,l;for(V=L[0],o=0;o<L.length-1;o++)l=f2(this,M[H+o],C,o),l===D1&&(l=this._$AH[o]),i||=!J2(l)||l!==this._$AH[o],l===s?V=s:V!==s&&(V+=(l??"")+L[o+1]),this._$AH[o]=l}i&&!e&&this.j(V)}j(V){V===s?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,V??"")}},I0=class extends b2{constructor(){super(...arguments),this.type=3}j(V){this.element[this.name]=V===s?void 0:V}},W0=class extends b2{constructor(){super(...arguments),this.type=4}j(V){this.element.toggleAttribute(this.name,!!V&&V!==s)}},j0=class extends b2{constructor(V,C,H,e,L){super(V,C,H,e,L),this.type=5}_$AI(V,C=this){if((V=f2(this,V,C,0)??s)===D1)return;let H=this._$AH,e=V===s&&H!==s||V.capture!==H.capture||V.once!==H.once||V.passive!==H.passive,L=V!==s&&(H===s||e);e&&this.element.removeEventListener(this.name,this,H),L&&this.element.addEventListener(this.name,this,V),this._$AH=V}handleEvent(V){typeof this._$AH=="function"?this._$AH.call(this.options?.host??this.element,V):this._$AH.handleEvent(V)}},U0=class{constructor(V,C,H){this.element=V,this.type=6,this._$AN=void 0,this._$AM=C,this.options=H}get _$AU(){return this._$AM._$AU}_$AI(V){f2(this,V)}};var z6=G0.litHtmlPolyfillSupport;z6?.(C5,H5),(G0.litHtmlVersions??=[]).push("3.3.3");var S4=(r,V,C)=>{let H=C?.renderBefore??V,e=H._$litPart$;if(e===void 0){let L=C?.renderBefore??null;H._$litPart$=e=new H5(V.insertBefore(Y2(),L),L,void 0,C??{})}return e._$AI(r),e};var Q0=globalThis,C1=class extends F1{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){let V=super.createRenderRoot();return this.renderOptions.renderBefore??=V.firstChild,V}update(V){let C=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(V),this._$Do=S4(C,this.renderRoot,this.renderOptions)}connectedCallback(){super.connectedCallback(),this._$Do?.setConnected(!0)}disconnectedCallback(){super.disconnectedCallback(),this._$Do?.setConnected(!1)}render(){return D1}};C1._$litElement$=!0,C1.finalized=!0,Q0.litElementHydrateSupport?.({LitElement:C1});var N6=Q0.litElementPolyfillSupport;N6?.({LitElement:C1});(Q0.litElementVersions??=[]).push("4.2.2");var I6={attribute:!0,type:String,converter:Q2,reflect:!1,hasChanged:R5},W6=(r=I6,V,C)=>{let{kind:H,metadata:e}=C,L=globalThis.litPropertyMetadata.get(e);if(L===void 0&&globalThis.litPropertyMetadata.set(e,L=new Map),H==="setter"&&((r=Object.create(r)).wrapped=!0),L.set(C.name,r),H==="accessor"){let{name:i}=C;return{set(M){let o=V.get.call(this);V.set.call(this,M),this.requestUpdate(i,o,r,!0,M)},init(M){return M!==void 0&&this.C(i,void 0,r,M),M}}}if(H==="setter"){let{name:i}=C;return function(M){let o=this[i];V.call(this,M),this.requestUpdate(i,o,r,!0,M)}}throw Error("Unsupported decorator location: "+H)};function T(r){return(V,C)=>typeof C=="object"?W6(r,V,C):((H,e,L)=>{let i=e.hasOwnProperty(L);return e.constructor.createProperty(L,H),i?Object.getOwnPropertyDescriptor(e,L):void 0})(r,V,C)}function k(r){return T({...r,state:!0,attribute:!1})}var a2=(r,V,C)=>(C.configurable=!0,C.enumerable=!0,Reflect.decorate&&typeof V!="object"&&Object.defineProperty(r,V,C),C);function D5(r,V){return(C,H,e)=>{let L=i=>i.renderRoot?.querySelector(r)??null;if(V){let{get:i,set:M}=typeof H=="object"?C:e??(()=>{let o=Symbol();return{get(){return this[o]},set(l){this[o]=l}}})();return a2(C,H,{get(){let o=i.call(this);return o===void 0&&(o=L(this),(o!==null||this.hasUpdated)&&M.call(this,o)),o}})}return a2(C,H,{get(){return L(this)}})}}var z5=class{constructor(V){this.hass=V}ws(V,C={}){return this.hass.connection.sendMessagePromise({type:`llmitmir/${V}`,...C})}subscribe(V){return this.hass.connection.subscribeMessage(V,{type:"llmitmir/subscribe"})}async sendFile(V,C,H,e){let i=Math.max(1,Math.ceil(H.size/786432)),M=Math.random().toString(36).slice(2)+Date.now().toString(36),o=null;for(let l=0;l<i;l++){let a=new FormData;a.append("scope",V),a.append("owner",C),a.append("filename",H.name),i>1&&(a.append("upload_id",M),a.append("index",String(l)),a.append("last",l===i-1?"1":"0")),a.append("file",H.slice(l*786432,(l+1)*786432),H.name);let m=null;for(let c=0;c<3;c++){try{if(m=await this.hass.fetchWithAuth("/api/llmitmir/upload",{method:"POST",body:a}),m.status<500)break}catch{}await new Promise(u=>setTimeout(u,1e3*(c+1)))}if(!m)throw new Error("Upload fehlgeschlagen");if(o=await m.json().catch(()=>({})),!m.ok)throw new Error(o.message||(m.status===413?"Datei zu gro\xDF f\xFCr den Webserver":`HTTP ${m.status}`));e?.(Math.min(H.size,(l+1)*786432),H.size)}return o}async upload(V,C,H){let e=[];for(let L of Array.from(H))e.push(...(await this.sendFile(V,C,L)).files||[]);return{files:e}}uploadImport(V,C){return this.sendFile("import","import",V,C)}async fileUrl(V,C,H){let e=await this.hass.fetchWithAuth(`/api/llmitmir/file/${V}/${C}/${H.split("/").map(encodeURIComponent).join("/")}`);if(!e.ok)throw new Error(`HTTP ${e.status}`);return URL.createObjectURL(await e.blob())}async transcribe(V){let C=await this.hass.fetchWithAuth("/api/llmitmir/transcribe",{method:"POST",body:V,headers:{"Content-Type":"audio/wav"}}),H=await C.json().catch(()=>({}));if(!C.ok)throw new Error(H.message||`HTTP ${C.status}`);return H.text||""}},X0=class extends EventTarget{constructor(){super(...arguments);this.data=null;this.chats=new Map;this.chatFiles=new Map;this.runs={};this.permissions=[];this.inbox=[];this.inboxPing=0;this.error="";this.toast=""}changed(){this.dispatchEvent(new Event("change"))}notify(C){this.toast=C,this.changed(),clearTimeout(this._t),this._t=setTimeout(()=>{this.toast="",this.changed()},4500)}async load(){this.data=await this.api.ws("bootstrap"),this.runs=this.data.runs||{},this.permissions=this.data.permissions||[],this.inbox=this.data.inbox||[],this.changed()}async loadChat(C,H=!1){if(!H&&this.chats.has(C))return this.chats.get(C);let e=await this.api.ws("chat/get",{chat_id:C});return this.chats.set(C,e.chat),this.chatFiles.set(C,e.files),this.changed(),e.chat}handle(C){let H=this.data;if(H){switch(C.type){case"chat":{let e=H.chats.findIndex(i=>i.id===C.chat.id);e>=0?H.chats[e]=C.chat:H.chats.unshift(C.chat),H.chats.sort((i,M)=>(M.updated||0)-(i.updated||0));let L=this.chats.get(C.chat.id);L&&Object.assign(L,{title:C.chat.title,status:C.chat.status,model:C.chat.model,model_auto:C.chat.model_auto,pinned:C.chat.pinned,project_id:C.chat.project_id,tools:C.chat.tools});break}case"queued":{let e=this.chats.get(C.chat_id);e&&(e.queued=C.items||[]);break}case"chat_deleted":H.chats=H.chats.filter(e=>e.id!==C.chat_id),this.chats.delete(C.chat_id);break;case"message":{let e=this.chats.get(C.chat_id);if(e){let L=e.messages.findIndex(i=>i.id===C.message.id);L>=0?e.messages[L]={...e.messages[L],...C.message}:e.messages.push(C.message),e.queued?.length&&(e.queued=e.queued.filter(i=>i.id!==C.message.id)),C.message.role==="tool"&&C.message.status!=="running"&&(e.messages=e.messages.filter(i=>!(i.status==="running"&&i.tool_call_id===C.message.tool_call_id&&i.id!==C.message.id)))}break}case"delta":{let L=this.chats.get(C.chat_id)?.messages.find(i=>i.id===C.message_id);L&&(L.content=(L.content||"")+(C.content||""),L.reasoning=(L.reasoning||"")+(C.reasoning||""));break}case"run":if(["done","error","stopped"].includes(C.status)){delete this.runs[C.chat_id];let e=this.chats.get(C.chat_id);e&&(e.messages=e.messages.filter(L=>!(L.streaming&&!L.content)))}else this.runs[C.chat_id]={run_id:C.run_id,status:C.status,detail:C.detail,started:C.started,hint:C.hint};break;case"permission":this.permissions=[...this.permissions.filter(e=>e.id!==C.permission.id),C.permission];break;case"permission_done":this.permissions=this.permissions.filter(e=>e.id!==C.id);break;case"progress":{let e=this.chats.get(C.chat_id);e&&(e.progress=C.items);break}case"files":this.chatFiles.set(C.chat_id,C.files);break;case"usage":if(H.usage=C.usage,C.usage?.external&&(H.external=C.usage.external),C.chat_id&&C.chat_usage){let e=this.chats.get(C.chat_id);e&&(e.usage=C.chat_usage)}break;case"cred_usage":{let e=(H.credentials||[]).find(L=>L.id===C.id);e&&(e.uses=C.uses,e.last_used=C.last_used,e.last_model=C.last_model,e.ext_uses=C.ext_uses,e.ext_uses_since=C.ext_uses_since,e.ext_last=C.ext_last);break}case"cred_check":{let e=(H.credentials||[]).find(L=>L.id===C.id);e&&(e.check=C.check);break}case"tasks_queue":H.queue=C.queue;break;case"inbox":{let e=new Set(this.inbox.map(L=>L.id));this.inbox=C.items||[],this.inbox.some(L=>!e.has(L.id))&&this.inboxPing++;break}case"models":H.models=C.models,H.defaults=C.defaults,C.external&&(H.external=C.external);break;case"meta":this.load();return;case"import_done":this.notify("Import abgeschlossen");break}this.changed()}}},A=new X0,E=()=>A.data?.view?.view!=="expert";function O(r,V=!1){let C=`/llmitmir${r.startsWith("/")?r:"/"+r}`;V?history.replaceState(null,"",C):history.pushState(null,"",C),window.dispatchEvent(new CustomEvent("location-changed",{detail:{replace:V}}))}var g4={ATTRIBUTE:1,CHILD:2,PROPERTY:3,BOOLEAN_ATTRIBUTE:4,EVENT:5,ELEMENT:6},f4=r=>(...V)=>({_$litDirective$:r,values:V}),N5=class{constructor(V){}get _$AU(){return this._$AM._$AU}_$AT(V,C,H){this._$Ct=V,this._$AM=C,this._$Ci=H}_$AS(V,C){return this.update(V,C)}update(V,C){return this.render(...C)}};var V5=class extends N5{constructor(V){if(super(V),this.it=s,V.type!==g4.CHILD)throw Error(this.constructor.directiveName+"() can only be used in child bindings")}render(V){if(V===s||V==null)return this._t=void 0,this.it=V;if(V===D1)return V;if(typeof V!="string")throw Error(this.constructor.directiveName+"() called with a non-string value");if(V===this.it)return this._t;this.it=V;let C=[V];return C.raw=C,this._t={_$litType$:this.constructor.resultType,strings:C,values:[]}}};V5.directiveName="unsafeHTML",V5.resultType=1;var Y0=f4(V5);function H7(){return{async:!1,breaks:!1,extensions:null,gfm:!0,hooks:null,pedantic:!1,renderer:null,silent:!1,tokenizer:null,walkTokens:null}}var s2=H7();function $4(r){s2=r}var T4=/[&<>"']/,j6=new RegExp(T4.source,"g"),P4=/[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/,U6=new RegExp(P4.source,"g"),G6={"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"},b4=r=>G6[r];function m1(r,V){if(V){if(T4.test(r))return r.replace(j6,b4)}else if(P4.test(r))return r.replace(U6,b4);return r}var q6=/(^|[^\[])\^/g;function N(r,V){let C=typeof r=="string"?r:r.source;V=V||"";let H={replace:(e,L)=>{let i=typeof L=="string"?L:L.source;return i=i.replace(q6,"$1"),C=C.replace(e,i),H},getRegex:()=>new RegExp(C,V)};return H}function k4(r){try{r=encodeURI(r).replace(/%25/g,"%")}catch{return null}return r}var t5={exec:()=>null};function y4(r,V){let C=r.replace(/\|/g,(L,i,M)=>{let o=!1,l=i;for(;--l>=0&&M[l]==="\\";)o=!o;return o?"|":" |"}),H=C.split(/ \|/),e=0;if(H[0].trim()||H.shift(),H.length>0&&!H[H.length-1].trim()&&H.pop(),V)if(H.length>V)H.splice(V);else for(;H.length<V;)H.push("");for(;e<H.length;e++)H[e]=H[e].trim().replace(/\\\|/g,"|");return H}function e5(r,V,C){let H=r.length;if(H===0)return"";let e=0;for(;e<H;){let L=r.charAt(H-e-1);if(L===V&&!C)e++;else if(L!==V&&C)e++;else break}return r.slice(0,H-e)}function K6(r,V){if(r.indexOf(V[1])===-1)return-1;let C=0;for(let H=0;H<r.length;H++)if(r[H]==="\\")H++;else if(r[H]===V[0])C++;else if(r[H]===V[1]&&(C--,C<0))return H;return-1}function w4(r,V,C,H){let e=V.href,L=V.title?m1(V.title):null,i=r[1].replace(/\\([\[\]])/g,"$1");if(r[0].charAt(0)!=="!"){H.state.inLink=!0;let M={type:"link",raw:C,href:e,title:L,text:i,tokens:H.inlineTokens(i)};return H.state.inLink=!1,M}return{type:"image",raw:C,href:e,title:L,text:m1(i)}}function Q6(r,V){let C=r.match(/^(\s+)(?:```)/);if(C===null)return V;let H=C[1];return V.split(`
`).map(e=>{let L=e.match(/^\s+/);if(L===null)return e;let[i]=L;return i.length>=H.length?e.slice(H.length):e}).join(`
`)}var k2=class{constructor(V){W(this,"options");W(this,"rules");W(this,"lexer");this.options=V||s2}space(V){let C=this.rules.block.newline.exec(V);if(C&&C[0].length>0)return{type:"space",raw:C[0]}}code(V){let C=this.rules.block.code.exec(V);if(C){let H=C[0].replace(/^(?: {1,4}| {0,3}\t)/gm,"");return{type:"code",raw:C[0],codeBlockStyle:"indented",text:this.options.pedantic?H:e5(H,`
`)}}}fences(V){let C=this.rules.block.fences.exec(V);if(C){let H=C[0],e=Q6(H,C[3]||"");return{type:"code",raw:H,lang:C[2]?C[2].trim().replace(this.rules.inline.anyPunctuation,"$1"):C[2],text:e}}}heading(V){let C=this.rules.block.heading.exec(V);if(C){let H=C[2].trim();if(/#$/.test(H)){let e=e5(H,"#");(this.options.pedantic||!e||/ $/.test(e))&&(H=e.trim())}return{type:"heading",raw:C[0],depth:C[1].length,text:H,tokens:this.lexer.inline(H)}}}hr(V){let C=this.rules.block.hr.exec(V);if(C)return{type:"hr",raw:e5(C[0],`
`)}}blockquote(V){let C=this.rules.block.blockquote.exec(V);if(C){let H=e5(C[0],`
`).split(`
`),e="",L="",i=[];for(;H.length>0;){let M=!1,o=[],l;for(l=0;l<H.length;l++)if(/^ {0,3}>/.test(H[l]))o.push(H[l]),M=!0;else if(!M)o.push(H[l]);else break;H=H.slice(l);let a=o.join(`
`),m=a.replace(/\n {0,3}((?:=+|-+) *)(?=\n|$)/g,`
    $1`).replace(/^ {0,3}>[ \t]?/gm,"");e=e?`${e}
${a}`:a,L=L?`${L}
${m}`:m;let c=this.lexer.state.top;if(this.lexer.state.top=!0,this.lexer.blockTokens(m,i,!0),this.lexer.state.top=c,H.length===0)break;let u=i[i.length-1];if(u?.type==="code")break;if(u?.type==="blockquote"){let b=u,x=b.raw+`
`+H.join(`
`),f=this.blockquote(x);i[i.length-1]=f,e=e.substring(0,e.length-b.raw.length)+f.raw,L=L.substring(0,L.length-b.text.length)+f.text;break}else if(u?.type==="list"){let b=u,x=b.raw+`
`+H.join(`
`),f=this.list(x);i[i.length-1]=f,e=e.substring(0,e.length-u.raw.length)+f.raw,L=L.substring(0,L.length-b.raw.length)+f.raw,H=x.substring(i[i.length-1].raw.length).split(`
`);continue}}return{type:"blockquote",raw:e,tokens:i,text:L}}}list(V){let C=this.rules.block.list.exec(V);if(C){let H=C[1].trim(),e=H.length>1,L={type:"list",raw:"",ordered:e,start:e?+H.slice(0,-1):"",loose:!1,items:[]};H=e?`\\d{1,9}\\${H.slice(-1)}`:`\\${H}`,this.options.pedantic&&(H=e?H:"[*+-]");let i=new RegExp(`^( {0,3}${H})((?:[	 ][^\\n]*)?(?:\\n|$))`),M=!1;for(;V;){let o=!1,l="",a="";if(!(C=i.exec(V))||this.rules.block.hr.test(V))break;l=C[0],V=V.substring(l.length);let m=C[2].split(`
`,1)[0].replace(/^\t+/,w=>" ".repeat(3*w.length)),c=V.split(`
`,1)[0],u=!m.trim(),b=0;if(this.options.pedantic?(b=2,a=m.trimStart()):u?b=C[1].length+1:(b=C[2].search(/[^ ]/),b=b>4?1:b,a=m.slice(b),b+=C[1].length),u&&/^[ \t]*$/.test(c)&&(l+=c+`
`,V=V.substring(c.length+1),o=!0),!o){let w=new RegExp(`^ {0,${Math.min(3,b-1)}}(?:[*+-]|\\d{1,9}[.)])((?:[ 	][^\\n]*)?(?:\\n|$))`),J=new RegExp(`^ {0,${Math.min(3,b-1)}}((?:- *){3,}|(?:_ *){3,}|(?:\\* *){3,})(?:\\n+|$)`),p1=new RegExp(`^ {0,${Math.min(3,b-1)}}(?:\`\`\`|~~~)`),y1=new RegExp(`^ {0,${Math.min(3,b-1)}}#`),W1=new RegExp(`^ {0,${Math.min(3,b-1)}}<(?:[a-z].*>|!--)`,"i");for(;V;){let j1=V.split(`
`,1)[0],L1;if(c=j1,this.options.pedantic?(c=c.replace(/^ {1,4}(?=( {4})*[^ ])/g,"  "),L1=c):L1=c.replace(/\t/g,"    "),p1.test(c)||y1.test(c)||W1.test(c)||w.test(c)||J.test(c))break;if(L1.search(/[^ ]/)>=b||!c.trim())a+=`
`+L1.slice(b);else{if(u||m.replace(/\t/g,"    ").search(/[^ ]/)>=4||p1.test(m)||y1.test(m)||J.test(m))break;a+=`
`+c}!u&&!c.trim()&&(u=!0),l+=j1+`
`,V=V.substring(j1.length+1),m=L1.slice(b)}}L.loose||(M?L.loose=!0:/\n[ \t]*\n[ \t]*$/.test(l)&&(M=!0));let x=null,f;this.options.gfm&&(x=/^\[[ xX]\] /.exec(a),x&&(f=x[0]!=="[ ] ",a=a.replace(/^\[[ xX]\] +/,""))),L.items.push({type:"list_item",raw:l,task:!!x,checked:f,loose:!1,text:a,tokens:[]}),L.raw+=l}L.items[L.items.length-1].raw=L.items[L.items.length-1].raw.trimEnd(),L.items[L.items.length-1].text=L.items[L.items.length-1].text.trimEnd(),L.raw=L.raw.trimEnd();for(let o=0;o<L.items.length;o++)if(this.lexer.state.top=!1,L.items[o].tokens=this.lexer.blockTokens(L.items[o].text,[]),!L.loose){let l=L.items[o].tokens.filter(m=>m.type==="space"),a=l.length>0&&l.some(m=>/\n.*\n/.test(m.raw));L.loose=a}if(L.loose)for(let o=0;o<L.items.length;o++)L.items[o].loose=!0;return L}}html(V){let C=this.rules.block.html.exec(V);if(C)return{type:"html",block:!0,raw:C[0],pre:C[1]==="pre"||C[1]==="script"||C[1]==="style",text:C[0]}}def(V){let C=this.rules.block.def.exec(V);if(C){let H=C[1].toLowerCase().replace(/\s+/g," "),e=C[2]?C[2].replace(/^<(.*)>$/,"$1").replace(this.rules.inline.anyPunctuation,"$1"):"",L=C[3]?C[3].substring(1,C[3].length-1).replace(this.rules.inline.anyPunctuation,"$1"):C[3];return{type:"def",tag:H,raw:C[0],href:e,title:L}}}table(V){let C=this.rules.block.table.exec(V);if(!C||!/[:|]/.test(C[2]))return;let H=y4(C[1]),e=C[2].replace(/^\||\| *$/g,"").split("|"),L=C[3]&&C[3].trim()?C[3].replace(/\n[ \t]*$/,"").split(`
`):[],i={type:"table",raw:C[0],header:[],align:[],rows:[]};if(H.length===e.length){for(let M of e)/^ *-+: *$/.test(M)?i.align.push("right"):/^ *:-+: *$/.test(M)?i.align.push("center"):/^ *:-+ *$/.test(M)?i.align.push("left"):i.align.push(null);for(let M=0;M<H.length;M++)i.header.push({text:H[M],tokens:this.lexer.inline(H[M]),header:!0,align:i.align[M]});for(let M of L)i.rows.push(y4(M,i.header.length).map((o,l)=>({text:o,tokens:this.lexer.inline(o),header:!1,align:i.align[l]})));return i}}lheading(V){let C=this.rules.block.lheading.exec(V);if(C)return{type:"heading",raw:C[0],depth:C[2].charAt(0)==="="?1:2,text:C[1],tokens:this.lexer.inline(C[1])}}paragraph(V){let C=this.rules.block.paragraph.exec(V);if(C){let H=C[1].charAt(C[1].length-1)===`
`?C[1].slice(0,-1):C[1];return{type:"paragraph",raw:C[0],text:H,tokens:this.lexer.inline(H)}}}text(V){let C=this.rules.block.text.exec(V);if(C)return{type:"text",raw:C[0],text:C[0],tokens:this.lexer.inline(C[0])}}escape(V){let C=this.rules.inline.escape.exec(V);if(C)return{type:"escape",raw:C[0],text:m1(C[1])}}tag(V){let C=this.rules.inline.tag.exec(V);if(C)return!this.lexer.state.inLink&&/^<a /i.test(C[0])?this.lexer.state.inLink=!0:this.lexer.state.inLink&&/^<\/a>/i.test(C[0])&&(this.lexer.state.inLink=!1),!this.lexer.state.inRawBlock&&/^<(pre|code|kbd|script)(\s|>)/i.test(C[0])?this.lexer.state.inRawBlock=!0:this.lexer.state.inRawBlock&&/^<\/(pre|code|kbd|script)(\s|>)/i.test(C[0])&&(this.lexer.state.inRawBlock=!1),{type:"html",raw:C[0],inLink:this.lexer.state.inLink,inRawBlock:this.lexer.state.inRawBlock,block:!1,text:C[0]}}link(V){let C=this.rules.inline.link.exec(V);if(C){let H=C[2].trim();if(!this.options.pedantic&&/^</.test(H)){if(!/>$/.test(H))return;let i=e5(H.slice(0,-1),"\\");if((H.length-i.length)%2===0)return}else{let i=K6(C[2],"()");if(i>-1){let o=(C[0].indexOf("!")===0?5:4)+C[1].length+i;C[2]=C[2].substring(0,i),C[0]=C[0].substring(0,o).trim(),C[3]=""}}let e=C[2],L="";if(this.options.pedantic){let i=/^([^'"]*[^\s])\s+(['"])(.*)\2/.exec(e);i&&(e=i[1],L=i[3])}else L=C[3]?C[3].slice(1,-1):"";return e=e.trim(),/^</.test(e)&&(this.options.pedantic&&!/>$/.test(H)?e=e.slice(1):e=e.slice(1,-1)),w4(C,{href:e&&e.replace(this.rules.inline.anyPunctuation,"$1"),title:L&&L.replace(this.rules.inline.anyPunctuation,"$1")},C[0],this.lexer)}}reflink(V,C){let H;if((H=this.rules.inline.reflink.exec(V))||(H=this.rules.inline.nolink.exec(V))){let e=(H[2]||H[1]).replace(/\s+/g," "),L=C[e.toLowerCase()];if(!L){let i=H[0].charAt(0);return{type:"text",raw:i,text:i}}return w4(H,L,H[0],this.lexer)}}emStrong(V,C,H=""){let e=this.rules.inline.emStrongLDelim.exec(V);if(!e||e[3]&&H.match(/[\p{L}\p{N}]/u))return;if(!(e[1]||e[2]||"")||!H||this.rules.inline.punctuation.exec(H)){let i=[...e[0]].length-1,M,o,l=i,a=0,m=e[0][0]==="*"?this.rules.inline.emStrongRDelimAst:this.rules.inline.emStrongRDelimUnd;for(m.lastIndex=0,C=C.slice(-1*V.length+i);(e=m.exec(C))!=null;){if(M=e[1]||e[2]||e[3]||e[4]||e[5]||e[6],!M)continue;if(o=[...M].length,e[3]||e[4]){l+=o;continue}else if((e[5]||e[6])&&i%3&&!((i+o)%3)){a+=o;continue}if(l-=o,l>0)continue;o=Math.min(o,o+l+a);let c=[...e[0]][0].length,u=V.slice(0,i+e.index+c+o);if(Math.min(i,o)%2){let x=u.slice(1,-1);return{type:"em",raw:u,text:x,tokens:this.lexer.inlineTokens(x)}}let b=u.slice(2,-2);return{type:"strong",raw:u,text:b,tokens:this.lexer.inlineTokens(b)}}}}codespan(V){let C=this.rules.inline.code.exec(V);if(C){let H=C[2].replace(/\n/g," "),e=/[^ ]/.test(H),L=/^ /.test(H)&&/ $/.test(H);return e&&L&&(H=H.substring(1,H.length-1)),H=m1(H,!0),{type:"codespan",raw:C[0],text:H}}}br(V){let C=this.rules.inline.br.exec(V);if(C)return{type:"br",raw:C[0]}}del(V){let C=this.rules.inline.del.exec(V);if(C)return{type:"del",raw:C[0],text:C[2],tokens:this.lexer.inlineTokens(C[2])}}autolink(V){let C=this.rules.inline.autolink.exec(V);if(C){let H,e;return C[2]==="@"?(H=m1(C[1]),e="mailto:"+H):(H=m1(C[1]),e=H),{type:"link",raw:C[0],text:H,href:e,tokens:[{type:"text",raw:H,text:H}]}}}url(V){let C;if(C=this.rules.inline.url.exec(V)){let H,e;if(C[2]==="@")H=m1(C[0]),e="mailto:"+H;else{let L;do L=C[0],C[0]=this.rules.inline._backpedal.exec(C[0])?.[0]??"";while(L!==C[0]);H=m1(C[0]),C[1]==="www."?e="http://"+C[0]:e=C[0]}return{type:"link",raw:C[0],text:H,href:e,tokens:[{type:"text",raw:H,text:H}]}}}inlineText(V){let C=this.rules.inline.text.exec(V);if(C){let H;return this.lexer.state.inRawBlock?H=C[0]:H=m1(C[0]),{type:"text",raw:C[0],text:H}}}},X6=/^(?:[ \t]*(?:\n|$))+/,Y6=/^((?: {4}| {0,3}\t)[^\n]+(?:\n(?:[ \t]*(?:\n|$))*)?)+/,J6=/^ {0,3}(`{3,}(?=[^`\n]*(?:\n|$))|~{3,})([^\n]*)(?:\n|$)(?:|([\s\S]*?)(?:\n|$))(?: {0,3}\1[~`]* *(?=\n|$)|$)/,i5=/^ {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/,C8=/^ {0,3}(#{1,6})(?=\s|$)(.*)(?:\n+|$)/,B4=/(?:[*+-]|\d{1,9}[.)])/,_4=N(/^(?!bull |blockCode|fences|blockquote|heading|html)((?:.|\n(?!\s*?\n|bull |blockCode|fences|blockquote|heading|html))+?)\n {0,3}(=+|-+) *(?:\n+|$)/).replace(/bull/g,B4).replace(/blockCode/g,/(?: {4}| {0,3}\t)/).replace(/fences/g,/ {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g,/ {0,3}>/).replace(/heading/g,/ {0,3}#{1,6}/).replace(/html/g,/ {0,3}<[^\n>]+>\n/).getRegex(),V7=/^([^\n]+(?:\n(?!hr|heading|lheading|blockquote|fences|list|html|table| +\n)[^\n]+)*)/,H8=/^[^\n]+/,e7=/(?!\s*\])(?:\\.|[^\[\]\\])+/,V8=N(/^ {0,3}\[(label)\]: *(?:\n[ \t]*)?([^<\s][^\s]*|<.*?>)(?:(?: +(?:\n[ \t]*)?| *\n[ \t]*)(title))? *(?:\n+|$)/).replace("label",e7).replace("title",/(?:"(?:\\"?|[^"\\])*"|'[^'\n]*(?:\n[^'\n]+)*\n?'|\([^()]*\))/).getRegex(),e8=N(/^( {0,3}bull)([ \t][^\n]+?)?(?:\n|$)/).replace(/bull/g,B4).getRegex(),j5="address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul",L7=/<!--(?:-?>|[\s\S]*?(?:-->|$))/,L8=N("^ {0,3}(?:<(script|pre|style|textarea)[\\s>][\\s\\S]*?(?:</\\1>[^\\n]*\\n+|$)|comment[^\\n]*(\\n+|$)|<\\?[\\s\\S]*?(?:\\?>\\n*|$)|<![A-Z][\\s\\S]*?(?:>\\n*|$)|<!\\[CDATA\\[[\\s\\S]*?(?:\\]\\]>\\n*|$)|</?(tag)(?: +|\\n|/?>)[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|<(?!script|pre|style|textarea)([a-z][\\w-]*)(?:attribute)*? */?>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|</(?!script|pre|style|textarea)[a-z][\\w-]*\\s*>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$))","i").replace("comment",L7).replace("tag",j5).replace("attribute",/ +[a-zA-Z:_][\w.:-]*(?: *= *"[^"\n]*"| *= *'[^'\n]*'| *= *[^\s"'=<>`]+)?/).getRegex(),E4=N(V7).replace("hr",i5).replace("heading"," {0,3}#{1,6}(?:\\s|$)").replace("|lheading","").replace("|table","").replace("blockquote"," {0,3}>").replace("fences"," {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list"," {0,3}(?:[*+-]|1[.)]) ").replace("html","</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag",j5).getRegex(),t8=N(/^( {0,3}> ?(paragraph|[^\n]*)(?:\n|$))+/).replace("paragraph",E4).getRegex(),t7={blockquote:t8,code:Y6,def:V8,fences:J6,heading:C8,hr:i5,html:L8,lheading:_4,list:e8,newline:X6,paragraph:E4,table:t5,text:H8},O4=N("^ *([^\\n ].*)\\n {0,3}((?:\\| *)?:?-+:? *(?:\\| *:?-+:? *)*(?:\\| *)?)(?:\\n((?:(?! *\\n|hr|heading|blockquote|code|fences|list|html).*(?:\\n|$))*)\\n*|$)").replace("hr",i5).replace("heading"," {0,3}#{1,6}(?:\\s|$)").replace("blockquote"," {0,3}>").replace("code","(?: {4}| {0,3}	)[^\\n]").replace("fences"," {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list"," {0,3}(?:[*+-]|1[.)]) ").replace("html","</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag",j5).getRegex(),r8={...t7,table:O4,paragraph:N(V7).replace("hr",i5).replace("heading"," {0,3}#{1,6}(?:\\s|$)").replace("|lheading","").replace("table",O4).replace("blockquote"," {0,3}>").replace("fences"," {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list"," {0,3}(?:[*+-]|1[.)]) ").replace("html","</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag",j5).getRegex()},i8={...t7,html:N(`^ *(?:comment *(?:\\n|\\s*$)|<(tag)[\\s\\S]+?</\\1> *(?:\\n{2,}|\\s*$)|<tag(?:"[^"]*"|'[^']*'|\\s[^'"/>\\s]*)*?/?> *(?:\\n{2,}|\\s*$))`).replace("comment",L7).replace(/tag/g,"(?!(?:a|em|strong|small|s|cite|q|dfn|abbr|data|time|code|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo|span|br|wbr|ins|del|img)\\b)\\w+(?!:|[^\\w\\s@]*@)\\b").getRegex(),def:/^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +(["(][^\n]+[")]))? *(?:\n+|$)/,heading:/^(#{1,6})(.*)(?:\n+|$)/,fences:t5,lheading:/^(.+?)\n {0,3}(=+|-+) *(?:\n+|$)/,paragraph:N(V7).replace("hr",i5).replace("heading",` *#{1,6} *[^
]`).replace("lheading",_4).replace("|table","").replace("blockquote"," {0,3}>").replace("|fences","").replace("|list","").replace("|html","").replace("|tag","").getRegex()},R4=/^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/,M8=/^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/,F4=/^( {2,}|\\)\n(?!\s*$)/,a8=/^(`+|[^`])(?:(?= {2,}\n)|[\s\S]*?(?:(?=[\\<!\[`*_]|\b_|$)|[^ ](?= {2,}\n)))/,M5="\\p{P}\\p{S}",o8=N(/^((?![*_])[\spunctuation])/,"u").replace(/punctuation/g,M5).getRegex(),n8=/\[[^[\]]*?\]\((?:\\.|[^\\\(\)]|\((?:\\.|[^\\\(\)])*\))*\)|`[^`]*?`|<[^<>]*?>/g,s8=N(/^(?:\*+(?:((?!\*)[punct])|[^\s*]))|^_+(?:((?!_)[punct])|([^\s_]))/,"u").replace(/punct/g,M5).getRegex(),l8=N("^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)[punct](\\*+)(?=[\\s]|$)|[^punct\\s](\\*+)(?!\\*)(?=[punct\\s]|$)|(?!\\*)[punct\\s](\\*+)(?=[^punct\\s])|[\\s](\\*+)(?!\\*)(?=[punct])|(?!\\*)[punct](\\*+)(?!\\*)(?=[punct])|[^punct\\s](\\*+)(?=[^punct\\s])","gu").replace(/punct/g,M5).getRegex(),d8=N("^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)[punct](_+)(?=[\\s]|$)|[^punct\\s](_+)(?!_)(?=[punct\\s]|$)|(?!_)[punct\\s](_+)(?=[^punct\\s])|[\\s](_+)(?!_)(?=[punct])|(?!_)[punct](_+)(?!_)(?=[punct])","gu").replace(/punct/g,M5).getRegex(),A8=N(/\\([punct])/,"gu").replace(/punct/g,M5).getRegex(),p8=N(/^<(scheme:[^\s\x00-\x1f<>]*|email)>/).replace("scheme",/[a-zA-Z][a-zA-Z0-9+.-]{1,31}/).replace("email",/[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_])/).getRegex(),m8=N(L7).replace("(?:-->|$)","-->").getRegex(),c8=N("^comment|^</[a-zA-Z][\\w:-]*\\s*>|^<[a-zA-Z][\\w-]*(?:attribute)*?\\s*/?>|^<\\?[\\s\\S]*?\\?>|^<![a-zA-Z]+\\s[\\s\\S]*?>|^<!\\[CDATA\\[[\\s\\S]*?\\]\\]>").replace("comment",m8).replace("attribute",/\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?/).getRegex(),W5=/(?:\[(?:\\.|[^\[\]\\])*\]|\\.|`[^`]*`|[^\[\]\\`])*?/,v8=N(/^!?\[(label)\]\(\s*(href)(?:\s+(title))?\s*\)/).replace("label",W5).replace("href",/<(?:\\.|[^\n<>\\])+>|[^\s\x00-\x1f]*/).replace("title",/"(?:\\"?|[^"\\])*"|'(?:\\'?|[^'\\])*'|\((?:\\\)?|[^)\\])*\)/).getRegex(),D4=N(/^!?\[(label)\]\[(ref)\]/).replace("label",W5).replace("ref",e7).getRegex(),z4=N(/^!?\[(ref)\](?:\[\])?/).replace("ref",e7).getRegex(),u8=N("reflink|nolink(?!\\()","g").replace("reflink",D4).replace("nolink",z4).getRegex(),r7={_backpedal:t5,anyPunctuation:A8,autolink:p8,blockSkip:n8,br:F4,code:M8,del:t5,emStrongLDelim:s8,emStrongRDelimAst:l8,emStrongRDelimUnd:d8,escape:R4,link:v8,nolink:z4,punctuation:o8,reflink:D4,reflinkSearch:u8,tag:c8,text:a8,url:t5},x8={...r7,link:N(/^!?\[(label)\]\((.*?)\)/).replace("label",W5).getRegex(),reflink:N(/^!?\[(label)\]\s*\[([^\]]*)\]/).replace("label",W5).getRegex()},J0={...r7,escape:N(R4).replace("])","~|])").getRegex(),url:N(/^((?:ftp|https?):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*|^email/,"i").replace("email",/[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![-_])/).getRegex(),_backpedal:/(?:[^?!.,:;*_'"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'"~)]+(?!$))+/,del:/^(~~?)(?=[^\s~])((?:\\.|[^\\])*?(?:\\.|[^\s~\\]))\1(?=[^~]|$)/,text:/^([`~]+|[^`~])(?:(?= {2,}\n)|(?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)|[\s\S]*?(?:(?=[\\<!\[`*~_]|\b_|https?:\/\/|ftp:\/\/|www\.|$)|[^ ](?= {2,}\n)|[^a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-](?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)))/},h8={...J0,br:N(F4).replace("{2,}","*").getRegex(),text:N(J0.text).replace("\\b_","\\b_| {2,}\\n").replace(/\{2,\}/g,"*").getRegex()},I5={normal:t7,gfm:r8,pedantic:i8},L5={normal:r7,gfm:J0,breaks:h8,pedantic:x8},g1=class r{constructor(V){W(this,"tokens");W(this,"options");W(this,"state");W(this,"tokenizer");W(this,"inlineQueue");this.tokens=[],this.tokens.links=Object.create(null),this.options=V||s2,this.options.tokenizer=this.options.tokenizer||new k2,this.tokenizer=this.options.tokenizer,this.tokenizer.options=this.options,this.tokenizer.lexer=this,this.inlineQueue=[],this.state={inLink:!1,inRawBlock:!1,top:!0};let C={block:I5.normal,inline:L5.normal};this.options.pedantic?(C.block=I5.pedantic,C.inline=L5.pedantic):this.options.gfm&&(C.block=I5.gfm,this.options.breaks?C.inline=L5.breaks:C.inline=L5.gfm),this.tokenizer.rules=C}static get rules(){return{block:I5,inline:L5}}static lex(V,C){return new r(C).lex(V)}static lexInline(V,C){return new r(C).inlineTokens(V)}lex(V){V=V.replace(/\r\n|\r/g,`
`),this.blockTokens(V,this.tokens);for(let C=0;C<this.inlineQueue.length;C++){let H=this.inlineQueue[C];this.inlineTokens(H.src,H.tokens)}return this.inlineQueue=[],this.tokens}blockTokens(V,C=[],H=!1){this.options.pedantic&&(V=V.replace(/\t/g,"    ").replace(/^ +$/gm,""));let e,L,i;for(;V;)if(!(this.options.extensions&&this.options.extensions.block&&this.options.extensions.block.some(M=>(e=M.call({lexer:this},V,C))?(V=V.substring(e.raw.length),C.push(e),!0):!1))){if(e=this.tokenizer.space(V)){V=V.substring(e.raw.length),e.raw.length===1&&C.length>0?C[C.length-1].raw+=`
`:C.push(e);continue}if(e=this.tokenizer.code(V)){V=V.substring(e.raw.length),L=C[C.length-1],L&&(L.type==="paragraph"||L.type==="text")?(L.raw+=`
`+e.raw,L.text+=`
`+e.text,this.inlineQueue[this.inlineQueue.length-1].src=L.text):C.push(e);continue}if(e=this.tokenizer.fences(V)){V=V.substring(e.raw.length),C.push(e);continue}if(e=this.tokenizer.heading(V)){V=V.substring(e.raw.length),C.push(e);continue}if(e=this.tokenizer.hr(V)){V=V.substring(e.raw.length),C.push(e);continue}if(e=this.tokenizer.blockquote(V)){V=V.substring(e.raw.length),C.push(e);continue}if(e=this.tokenizer.list(V)){V=V.substring(e.raw.length),C.push(e);continue}if(e=this.tokenizer.html(V)){V=V.substring(e.raw.length),C.push(e);continue}if(e=this.tokenizer.def(V)){V=V.substring(e.raw.length),L=C[C.length-1],L&&(L.type==="paragraph"||L.type==="text")?(L.raw+=`
`+e.raw,L.text+=`
`+e.raw,this.inlineQueue[this.inlineQueue.length-1].src=L.text):this.tokens.links[e.tag]||(this.tokens.links[e.tag]={href:e.href,title:e.title});continue}if(e=this.tokenizer.table(V)){V=V.substring(e.raw.length),C.push(e);continue}if(e=this.tokenizer.lheading(V)){V=V.substring(e.raw.length),C.push(e);continue}if(i=V,this.options.extensions&&this.options.extensions.startBlock){let M=1/0,o=V.slice(1),l;this.options.extensions.startBlock.forEach(a=>{l=a.call({lexer:this},o),typeof l=="number"&&l>=0&&(M=Math.min(M,l))}),M<1/0&&M>=0&&(i=V.substring(0,M+1))}if(this.state.top&&(e=this.tokenizer.paragraph(i))){L=C[C.length-1],H&&L?.type==="paragraph"?(L.raw+=`
`+e.raw,L.text+=`
`+e.text,this.inlineQueue.pop(),this.inlineQueue[this.inlineQueue.length-1].src=L.text):C.push(e),H=i.length!==V.length,V=V.substring(e.raw.length);continue}if(e=this.tokenizer.text(V)){V=V.substring(e.raw.length),L=C[C.length-1],L&&L.type==="text"?(L.raw+=`
`+e.raw,L.text+=`
`+e.text,this.inlineQueue.pop(),this.inlineQueue[this.inlineQueue.length-1].src=L.text):C.push(e);continue}if(V){let M="Infinite loop on byte: "+V.charCodeAt(0);if(this.options.silent){console.error(M);break}else throw new Error(M)}}return this.state.top=!0,C}inline(V,C=[]){return this.inlineQueue.push({src:V,tokens:C}),C}inlineTokens(V,C=[]){let H,e,L,i=V,M,o,l;if(this.tokens.links){let a=Object.keys(this.tokens.links);if(a.length>0)for(;(M=this.tokenizer.rules.inline.reflinkSearch.exec(i))!=null;)a.includes(M[0].slice(M[0].lastIndexOf("[")+1,-1))&&(i=i.slice(0,M.index)+"["+"a".repeat(M[0].length-2)+"]"+i.slice(this.tokenizer.rules.inline.reflinkSearch.lastIndex))}for(;(M=this.tokenizer.rules.inline.blockSkip.exec(i))!=null;)i=i.slice(0,M.index)+"["+"a".repeat(M[0].length-2)+"]"+i.slice(this.tokenizer.rules.inline.blockSkip.lastIndex);for(;(M=this.tokenizer.rules.inline.anyPunctuation.exec(i))!=null;)i=i.slice(0,M.index)+"++"+i.slice(this.tokenizer.rules.inline.anyPunctuation.lastIndex);for(;V;)if(o||(l=""),o=!1,!(this.options.extensions&&this.options.extensions.inline&&this.options.extensions.inline.some(a=>(H=a.call({lexer:this},V,C))?(V=V.substring(H.raw.length),C.push(H),!0):!1))){if(H=this.tokenizer.escape(V)){V=V.substring(H.raw.length),C.push(H);continue}if(H=this.tokenizer.tag(V)){V=V.substring(H.raw.length),e=C[C.length-1],e&&H.type==="text"&&e.type==="text"?(e.raw+=H.raw,e.text+=H.text):C.push(H);continue}if(H=this.tokenizer.link(V)){V=V.substring(H.raw.length),C.push(H);continue}if(H=this.tokenizer.reflink(V,this.tokens.links)){V=V.substring(H.raw.length),e=C[C.length-1],e&&H.type==="text"&&e.type==="text"?(e.raw+=H.raw,e.text+=H.text):C.push(H);continue}if(H=this.tokenizer.emStrong(V,i,l)){V=V.substring(H.raw.length),C.push(H);continue}if(H=this.tokenizer.codespan(V)){V=V.substring(H.raw.length),C.push(H);continue}if(H=this.tokenizer.br(V)){V=V.substring(H.raw.length),C.push(H);continue}if(H=this.tokenizer.del(V)){V=V.substring(H.raw.length),C.push(H);continue}if(H=this.tokenizer.autolink(V)){V=V.substring(H.raw.length),C.push(H);continue}if(!this.state.inLink&&(H=this.tokenizer.url(V))){V=V.substring(H.raw.length),C.push(H);continue}if(L=V,this.options.extensions&&this.options.extensions.startInline){let a=1/0,m=V.slice(1),c;this.options.extensions.startInline.forEach(u=>{c=u.call({lexer:this},m),typeof c=="number"&&c>=0&&(a=Math.min(a,c))}),a<1/0&&a>=0&&(L=V.substring(0,a+1))}if(H=this.tokenizer.inlineText(L)){V=V.substring(H.raw.length),H.raw.slice(-1)!=="_"&&(l=H.raw.slice(-1)),o=!0,e=C[C.length-1],e&&e.type==="text"?(e.raw+=H.raw,e.text+=H.text):C.push(H);continue}if(V){let a="Infinite loop on byte: "+V.charCodeAt(0);if(this.options.silent){console.error(a);break}else throw new Error(a)}}return C}},y2=class{constructor(V){W(this,"options");W(this,"parser");this.options=V||s2}space(V){return""}code({text:V,lang:C,escaped:H}){let e=(C||"").match(/^\S*/)?.[0],L=V.replace(/\n$/,"")+`
`;return e?'<pre><code class="language-'+m1(e)+'">'+(H?L:m1(L,!0))+`</code></pre>
`:"<pre><code>"+(H?L:m1(L,!0))+`</code></pre>
`}blockquote({tokens:V}){return`<blockquote>
${this.parser.parse(V)}</blockquote>
`}html({text:V}){return V}heading({tokens:V,depth:C}){return`<h${C}>${this.parser.parseInline(V)}</h${C}>
`}hr(V){return`<hr>
`}list(V){let C=V.ordered,H=V.start,e="";for(let M=0;M<V.items.length;M++){let o=V.items[M];e+=this.listitem(o)}let L=C?"ol":"ul",i=C&&H!==1?' start="'+H+'"':"";return"<"+L+i+`>
`+e+"</"+L+`>
`}listitem(V){let C="";if(V.task){let H=this.checkbox({checked:!!V.checked});V.loose?V.tokens.length>0&&V.tokens[0].type==="paragraph"?(V.tokens[0].text=H+" "+V.tokens[0].text,V.tokens[0].tokens&&V.tokens[0].tokens.length>0&&V.tokens[0].tokens[0].type==="text"&&(V.tokens[0].tokens[0].text=H+" "+V.tokens[0].tokens[0].text)):V.tokens.unshift({type:"text",raw:H+" ",text:H+" "}):C+=H+" "}return C+=this.parser.parse(V.tokens,!!V.loose),`<li>${C}</li>
`}checkbox({checked:V}){return"<input "+(V?'checked="" ':"")+'disabled="" type="checkbox">'}paragraph({tokens:V}){return`<p>${this.parser.parseInline(V)}</p>
`}table(V){let C="",H="";for(let L=0;L<V.header.length;L++)H+=this.tablecell(V.header[L]);C+=this.tablerow({text:H});let e="";for(let L=0;L<V.rows.length;L++){let i=V.rows[L];H="";for(let M=0;M<i.length;M++)H+=this.tablecell(i[M]);e+=this.tablerow({text:H})}return e&&(e=`<tbody>${e}</tbody>`),`<table>
<thead>
`+C+`</thead>
`+e+`</table>
`}tablerow({text:V}){return`<tr>
${V}</tr>
`}tablecell(V){let C=this.parser.parseInline(V.tokens),H=V.header?"th":"td";return(V.align?`<${H} align="${V.align}">`:`<${H}>`)+C+`</${H}>
`}strong({tokens:V}){return`<strong>${this.parser.parseInline(V)}</strong>`}em({tokens:V}){return`<em>${this.parser.parseInline(V)}</em>`}codespan({text:V}){return`<code>${V}</code>`}br(V){return"<br>"}del({tokens:V}){return`<del>${this.parser.parseInline(V)}</del>`}link({href:V,title:C,tokens:H}){let e=this.parser.parseInline(H),L=k4(V);if(L===null)return e;V=L;let i='<a href="'+V+'"';return C&&(i+=' title="'+C+'"'),i+=">"+e+"</a>",i}image({href:V,title:C,text:H}){let e=k4(V);if(e===null)return H;V=e;let L=`<img src="${V}" alt="${H}"`;return C&&(L+=` title="${C}"`),L+=">",L}text(V){return"tokens"in V&&V.tokens?this.parser.parseInline(V.tokens):V.text}},r5=class{strong({text:V}){return V}em({text:V}){return V}codespan({text:V}){return V}del({text:V}){return V}html({text:V}){return V}text({text:V}){return V}link({text:V}){return""+V}image({text:V}){return""+V}br(){return""}},f1=class r{constructor(V){W(this,"options");W(this,"renderer");W(this,"textRenderer");this.options=V||s2,this.options.renderer=this.options.renderer||new y2,this.renderer=this.options.renderer,this.renderer.options=this.options,this.renderer.parser=this,this.textRenderer=new r5}static parse(V,C){return new r(C).parse(V)}static parseInline(V,C){return new r(C).parseInline(V)}parse(V,C=!0){let H="";for(let e=0;e<V.length;e++){let L=V[e];if(this.options.extensions&&this.options.extensions.renderers&&this.options.extensions.renderers[L.type]){let M=L,o=this.options.extensions.renderers[M.type].call({parser:this},M);if(o!==!1||!["space","hr","heading","code","table","blockquote","list","html","paragraph","text"].includes(M.type)){H+=o||"";continue}}let i=L;switch(i.type){case"space":{H+=this.renderer.space(i);continue}case"hr":{H+=this.renderer.hr(i);continue}case"heading":{H+=this.renderer.heading(i);continue}case"code":{H+=this.renderer.code(i);continue}case"table":{H+=this.renderer.table(i);continue}case"blockquote":{H+=this.renderer.blockquote(i);continue}case"list":{H+=this.renderer.list(i);continue}case"html":{H+=this.renderer.html(i);continue}case"paragraph":{H+=this.renderer.paragraph(i);continue}case"text":{let M=i,o=this.renderer.text(M);for(;e+1<V.length&&V[e+1].type==="text";)M=V[++e],o+=`
`+this.renderer.text(M);C?H+=this.renderer.paragraph({type:"paragraph",raw:o,text:o,tokens:[{type:"text",raw:o,text:o}]}):H+=o;continue}default:{let M='Token with "'+i.type+'" type was not found.';if(this.options.silent)return console.error(M),"";throw new Error(M)}}}return H}parseInline(V,C){C=C||this.renderer;let H="";for(let e=0;e<V.length;e++){let L=V[e];if(this.options.extensions&&this.options.extensions.renderers&&this.options.extensions.renderers[L.type]){let M=this.options.extensions.renderers[L.type].call({parser:this},L);if(M!==!1||!["escape","html","link","image","strong","em","codespan","br","del","text"].includes(L.type)){H+=M||"";continue}}let i=L;switch(i.type){case"escape":{H+=C.text(i);break}case"html":{H+=C.html(i);break}case"link":{H+=C.link(i);break}case"image":{H+=C.image(i);break}case"strong":{H+=C.strong(i);break}case"em":{H+=C.em(i);break}case"codespan":{H+=C.codespan(i);break}case"br":{H+=C.br(i);break}case"del":{H+=C.del(i);break}case"text":{H+=C.text(i);break}default:{let M='Token with "'+i.type+'" type was not found.';if(this.options.silent)return console.error(M),"";throw new Error(M)}}}return H}},o2=class{constructor(V){W(this,"options");W(this,"block");this.options=V||s2}preprocess(V){return V}postprocess(V){return V}processAllTokens(V){return V}provideLexer(){return this.block?g1.lex:g1.lexInline}provideParser(){return this.block?f1.parse:f1.parseInline}};W(o2,"passThroughHooks",new Set(["preprocess","postprocess","processAllTokens"]));var C7=class{constructor(...V){W(this,"defaults",H7());W(this,"options",this.setOptions);W(this,"parse",this.parseMarkdown(!0));W(this,"parseInline",this.parseMarkdown(!1));W(this,"Parser",f1);W(this,"Renderer",y2);W(this,"TextRenderer",r5);W(this,"Lexer",g1);W(this,"Tokenizer",k2);W(this,"Hooks",o2);this.use(...V)}walkTokens(V,C){let H=[];for(let e of V)switch(H=H.concat(C.call(this,e)),e.type){case"table":{let L=e;for(let i of L.header)H=H.concat(this.walkTokens(i.tokens,C));for(let i of L.rows)for(let M of i)H=H.concat(this.walkTokens(M.tokens,C));break}case"list":{let L=e;H=H.concat(this.walkTokens(L.items,C));break}default:{let L=e;this.defaults.extensions?.childTokens?.[L.type]?this.defaults.extensions.childTokens[L.type].forEach(i=>{let M=L[i].flat(1/0);H=H.concat(this.walkTokens(M,C))}):L.tokens&&(H=H.concat(this.walkTokens(L.tokens,C)))}}return H}use(...V){let C=this.defaults.extensions||{renderers:{},childTokens:{}};return V.forEach(H=>{let e={...H};if(e.async=this.defaults.async||e.async||!1,H.extensions&&(H.extensions.forEach(L=>{if(!L.name)throw new Error("extension name required");if("renderer"in L){let i=C.renderers[L.name];i?C.renderers[L.name]=function(...M){let o=L.renderer.apply(this,M);return o===!1&&(o=i.apply(this,M)),o}:C.renderers[L.name]=L.renderer}if("tokenizer"in L){if(!L.level||L.level!=="block"&&L.level!=="inline")throw new Error("extension level must be 'block' or 'inline'");let i=C[L.level];i?i.unshift(L.tokenizer):C[L.level]=[L.tokenizer],L.start&&(L.level==="block"?C.startBlock?C.startBlock.push(L.start):C.startBlock=[L.start]:L.level==="inline"&&(C.startInline?C.startInline.push(L.start):C.startInline=[L.start]))}"childTokens"in L&&L.childTokens&&(C.childTokens[L.name]=L.childTokens)}),e.extensions=C),H.renderer){let L=this.defaults.renderer||new y2(this.defaults);for(let i in H.renderer){if(!(i in L))throw new Error(`renderer '${i}' does not exist`);if(["options","parser"].includes(i))continue;let M=i,o=H.renderer[M],l=L[M];L[M]=(...a)=>{let m=o.apply(L,a);return m===!1&&(m=l.apply(L,a)),m||""}}e.renderer=L}if(H.tokenizer){let L=this.defaults.tokenizer||new k2(this.defaults);for(let i in H.tokenizer){if(!(i in L))throw new Error(`tokenizer '${i}' does not exist`);if(["options","rules","lexer"].includes(i))continue;let M=i,o=H.tokenizer[M],l=L[M];L[M]=(...a)=>{let m=o.apply(L,a);return m===!1&&(m=l.apply(L,a)),m}}e.tokenizer=L}if(H.hooks){let L=this.defaults.hooks||new o2;for(let i in H.hooks){if(!(i in L))throw new Error(`hook '${i}' does not exist`);if(["options","block"].includes(i))continue;let M=i,o=H.hooks[M],l=L[M];o2.passThroughHooks.has(i)?L[M]=a=>{if(this.defaults.async)return Promise.resolve(o.call(L,a)).then(c=>l.call(L,c));let m=o.call(L,a);return l.call(L,m)}:L[M]=(...a)=>{let m=o.apply(L,a);return m===!1&&(m=l.apply(L,a)),m}}e.hooks=L}if(H.walkTokens){let L=this.defaults.walkTokens,i=H.walkTokens;e.walkTokens=function(M){let o=[];return o.push(i.call(this,M)),L&&(o=o.concat(L.call(this,M))),o}}this.defaults={...this.defaults,...e}}),this}setOptions(V){return this.defaults={...this.defaults,...V},this}lexer(V,C){return g1.lex(V,C??this.defaults)}parser(V,C){return f1.parse(V,C??this.defaults)}parseMarkdown(V){return(H,e)=>{let L={...e},i={...this.defaults,...L},M=this.onError(!!i.silent,!!i.async);if(this.defaults.async===!0&&L.async===!1)return M(new Error("marked(): The async option was set to true by an extension. Remove async: false from the parse options object to return a Promise."));if(typeof H>"u"||H===null)return M(new Error("marked(): input parameter is undefined or null"));if(typeof H!="string")return M(new Error("marked(): input parameter is of type "+Object.prototype.toString.call(H)+", string expected"));i.hooks&&(i.hooks.options=i,i.hooks.block=V);let o=i.hooks?i.hooks.provideLexer():V?g1.lex:g1.lexInline,l=i.hooks?i.hooks.provideParser():V?f1.parse:f1.parseInline;if(i.async)return Promise.resolve(i.hooks?i.hooks.preprocess(H):H).then(a=>o(a,i)).then(a=>i.hooks?i.hooks.processAllTokens(a):a).then(a=>i.walkTokens?Promise.all(this.walkTokens(a,i.walkTokens)).then(()=>a):a).then(a=>l(a,i)).then(a=>i.hooks?i.hooks.postprocess(a):a).catch(M);try{i.hooks&&(H=i.hooks.preprocess(H));let a=o(H,i);i.hooks&&(a=i.hooks.processAllTokens(a)),i.walkTokens&&this.walkTokens(a,i.walkTokens);let m=l(a,i);return i.hooks&&(m=i.hooks.postprocess(m)),m}catch(a){return M(a)}}}onError(V,C){return H=>{if(H.message+=`
Please report this to https://github.com/markedjs/marked.`,V){let e="<p>An error occurred:</p><pre>"+m1(H.message+"",!0)+"</pre>";return C?Promise.resolve(e):e}if(C)return Promise.reject(H);throw H}}},n2=new C7;function R(r,V){return n2.parse(r,V)}R.options=R.setOptions=function(r){return n2.setOptions(r),R.defaults=n2.defaults,$4(R.defaults),R};R.getDefaults=H7;R.defaults=s2;R.use=function(...r){return n2.use(...r),R.defaults=n2.defaults,$4(R.defaults),R};R.walkTokens=function(r,V){return n2.walkTokens(r,V)};R.parseInline=n2.parseInline;R.Parser=f1;R.parser=f1.parse;R.Renderer=y2;R.TextRenderer=r5;R.Lexer=g1;R.lexer=g1.lex;R.Tokenizer=k2;R.Hooks=o2;R.parse=R;var fH=R.options,bH=R.setOptions,kH=R.use,yH=R.walkTokens,wH=R.parseInline;var OH=f1.parse,$H=g1.lex;function Z8(r,V){this.v=r,this.k=V}function N4(r,V){(V==null||V>r.length)&&(V=r.length);for(var C=0,H=Array(V);C<V;C++)H[C]=r[C];return H}function S8(r){if(Array.isArray(r))return r}function g8(r,V){var C=r==null?null:typeof Symbol<"u"&&r[Symbol.iterator]||r["@@iterator"];if(C!=null){var H,e,L,i,M=[],o=!0,l=!1;try{if(L=(C=C.call(r)).next,V===0){if(Object(C)!==C)return;o=!1}else for(;!(o=(H=L.call(C)).done)&&(M.push(H.value),M.length!==V);o=!0);}catch(a){l=!0,e=a}finally{try{if(!o&&C.return!=null&&(i=C.return(),Object(i)!==i))return}finally{if(l)throw e}}return M}}function f8(){throw new TypeError(`Invalid attempt to destructure non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`)}function b8(r,V){return S8(r)||g8(r,V)||k8(r,V)||f8()}function k8(r,V){if(r){if(typeof r=="string")return N4(r,V);var C={}.toString.call(r).slice(8,-1);return C==="Object"&&r.constructor&&(C=r.constructor.name),C==="Map"||C==="Set"?Array.from(r):C==="Arguments"||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(C)?N4(r,V):void 0}}function U5(r){var V,C;function H(L,i){try{var M=r[L](i),o=M.value,l=o instanceof Z8;Promise.resolve(l?o.v:o).then(function(a){if(l){var m=L==="return"&&o.k?L:"next";if(!o.k||a.done)return H(m,a);a=r[m](a).value}e(!!M.done,a)},function(a){H("throw",a)})}catch(a){e(2,a)}}function e(L,i){L===2?V.reject(i):V.resolve({value:i,done:L}),(V=V.next)?H(V.key,V.arg):C=null}this._invoke=function(L,i){return new Promise(function(M,o){var l={key:L,arg:i,resolve:M,reject:o,next:null};C?C=C.next=l:(V=C=l,H(L,i))})},typeof r.return!="function"&&(this.return=void 0)}U5.prototype[typeof Symbol=="function"&&Symbol.asyncIterator||"@@asyncIterator"]=function(){return this},U5.prototype.next=function(r){return this._invoke("next",r)},U5.prototype.throw=function(r){return this._invoke("throw",r)},U5.prototype.return=function(r){return this._invoke("return",r)};var e9=Object.entries,I4=Object.setPrototypeOf,y8=Object.isFrozen,L9=Object.getPrototypeOf,t9=Object.getOwnPropertyDescriptor,t1=Object.freeze,M1=Object.seal,w2=Object.create,r9=typeof Reflect<"u"&&Reflect,p7=r9.apply,m7=r9.construct;t1||(t1=function(V){return V});M1||(M1=function(V){return V});p7||(p7=function(V,C){for(var H=arguments.length,e=new Array(H>2?H-2:0),L=2;L<H;L++)e[L-2]=arguments[L];return V.apply(C,e)});m7||(m7=function(V){for(var C=arguments.length,H=new Array(C>1?C-1:0),e=1;e<C;e++)H[e-1]=arguments[e];return new V(...H)});var z1=Q(Array.prototype.forEach);Array.prototype.indexOf;var w8=Q(Array.prototype.lastIndexOf),W4=Q(Array.prototype.pop),a5=Q(Array.prototype.push),O8=Q(Array.prototype.slice),$8=Q(Array.prototype.splice),O2=Array.isArray,i7=i9(Set),M7=Q(Set.prototype.add),o5=Q(Set.prototype.has),l2=Q(String.prototype.toLowerCase),a7=Q(String.prototype.toString),j4=Q(String.prototype.match),n5=Q(String.prototype.replace),U4=Q(String.prototype.indexOf),T8=Q(String.prototype.trim),P8=Q(Number.prototype.toString),B8=Q(Boolean.prototype.toString),G4=typeof BigInt>"u"?null:Q(BigInt.prototype.toString),q4=typeof Symbol>"u"?null:Q(Symbol.prototype.toString),d1=Q(Object.prototype.hasOwnProperty),s5=Q(Object.prototype.toString),i1=Q(RegExp.prototype.test),N1=i9(TypeError);function Q(r){return function(V){V instanceof RegExp&&(V.lastIndex=0);for(var C=arguments.length,H=new Array(C>1?C-1:0),e=1;e<C;e++)H[e-1]=arguments[e];return p7(r,V,H)}}function i9(r){return function(){for(var V=arguments.length,C=new Array(V),H=0;H<V;H++)C[H]=arguments[H];return m7(r,C)}}function _(r,V){let C=arguments.length>2&&arguments[2]!==void 0?arguments[2]:l2;if(I4&&I4(r,null),!O2(V))return r;let H=V.length;for(;H--;){let e=V[H];if(typeof e=="string"){let L=C(e);L!==e&&(y8(V)||(V[H]=L),e=L)}r[e]=!0}return r}function _8(r){for(let V=0;V<r.length;V++)d1(r,V)||(r[V]=null);return r}function c1(r){let V=w2(null);for(let H of e9(r)){var C=b8(H,2);let e=C[0],L=C[1];d1(r,e)&&(O2(L)?V[e]=_8(L):L&&typeof L=="object"&&L.constructor===Object?V[e]=c1(L):V[e]=L)}return V}function E8(r){switch(typeof r){case"string":return r;case"number":return P8(r);case"boolean":return B8(r);case"bigint":return G4?G4(r):"0";case"symbol":return q4?q4(r):"Symbol()";case"undefined":return s5(r);case"function":case"object":{if(r===null)return s5(r);let V=r,C=u1(V,"toString");if(typeof C=="function"){let H=C(V);return typeof H=="string"?H:s5(H)}return s5(r)}default:return s5(r)}}function u1(r,V){for(;r!==null;){let H=t9(r,V);if(H){if(H.get)return Q(H.get);if(typeof H.value=="function")return Q(H.value)}r=L9(r)}function C(){return null}return C}function R8(r,V){for(;r!==null;){let C=t9(r,V);if(C)return C.get?Q(C.get):null;r=L9(r)}return null}function F8(r){try{return i1(r,""),!0}catch{return!1}}var K4=t1(["a","abbr","acronym","address","area","article","aside","audio","b","bdi","bdo","big","blink","blockquote","body","br","button","canvas","caption","center","cite","code","col","colgroup","content","data","datalist","dd","decorator","del","details","dfn","dialog","dir","div","dl","dt","element","em","fieldset","figcaption","figure","font","footer","form","h1","h2","h3","h4","h5","h6","head","header","hgroup","hr","html","i","img","input","ins","kbd","label","legend","li","main","map","mark","marquee","menu","menuitem","meter","nav","nobr","ol","optgroup","option","output","p","picture","pre","progress","q","rp","rt","ruby","s","samp","search","section","select","shadow","slot","small","source","spacer","span","strike","strong","style","sub","summary","sup","table","tbody","td","template","textarea","tfoot","th","thead","time","tr","track","tt","u","ul","var","video","wbr"]),o7=t1(["svg","a","altglyph","altglyphdef","altglyphitem","animatecolor","animatemotion","animatetransform","circle","clippath","defs","desc","ellipse","enterkeyhint","exportparts","filter","font","g","glyph","glyphref","hkern","image","inputmode","line","lineargradient","marker","mask","metadata","mpath","part","path","pattern","polygon","polyline","radialgradient","rect","stop","style","switch","symbol","text","textpath","title","tref","tspan","view","vkern"]),n7=t1(["feBlend","feColorMatrix","feComponentTransfer","feComposite","feConvolveMatrix","feDiffuseLighting","feDisplacementMap","feDistantLight","feDropShadow","feFlood","feFuncA","feFuncB","feFuncG","feFuncR","feGaussianBlur","feImage","feMerge","feMergeNode","feMorphology","feOffset","fePointLight","feSpecularLighting","feSpotLight","feTile","feTurbulence"]),D8=t1(["animate","color-profile","cursor","discard","font-face","font-face-format","font-face-name","font-face-src","font-face-uri","foreignobject","hatch","hatchpath","mesh","meshgradient","meshpatch","meshrow","missing-glyph","script","set","solidcolor","unknown","use"]),s7=t1(["math","menclose","merror","mfenced","mfrac","mglyph","mi","mlabeledtr","mmultiscripts","mn","mo","mover","mpadded","mphantom","mroot","mrow","ms","mspace","msqrt","mstyle","msub","msup","msubsup","mtable","mtd","mtext","mtr","munder","munderover","mprescripts"]),z8=t1(["maction","maligngroup","malignmark","mlongdiv","mscarries","mscarry","msgroup","mstack","msline","msrow","semantics","annotation","annotation-xml","mprescripts","none"]),Q4=t1(["#text"]),X4=t1(["accept","action","align","alt","autocapitalize","autocomplete","autopictureinpicture","autoplay","background","bgcolor","border","capture","cellpadding","cellspacing","checked","cite","class","clear","color","cols","colspan","command","commandfor","controls","controlslist","coords","crossorigin","datetime","decoding","default","dir","disabled","disablepictureinpicture","disableremoteplayback","download","draggable","enctype","enterkeyhint","exportparts","face","for","headers","height","hidden","high","href","hreflang","id","inert","inputmode","integrity","ismap","kind","label","lang","list","loading","loop","low","max","maxlength","media","method","min","minlength","multiple","muted","name","nonce","noshade","novalidate","nowrap","open","optimum","part","pattern","placeholder","playsinline","popover","popovertarget","popovertargetaction","poster","preload","pubdate","radiogroup","readonly","rel","required","rev","reversed","role","rows","rowspan","spellcheck","scope","selected","shape","size","sizes","slot","span","srclang","start","src","srcset","step","style","summary","tabindex","title","translate","type","usemap","valign","value","width","wrap","xmlns"]),l7=t1(["accent-height","accumulate","additive","alignment-baseline","amplitude","ascent","attributename","attributetype","azimuth","basefrequency","baseline-shift","begin","bias","by","class","clip","clippathunits","clip-path","clip-rule","color","color-interpolation","color-interpolation-filters","color-profile","color-rendering","cx","cy","d","dx","dy","diffuseconstant","direction","display","divisor","dominant-baseline","dur","edgemode","elevation","end","exponent","fill","fill-opacity","fill-rule","filter","filterunits","flood-color","flood-opacity","font-family","font-size","font-size-adjust","font-stretch","font-style","font-variant","font-weight","fx","fy","g1","g2","glyph-name","glyphref","gradientunits","gradienttransform","height","href","id","image-rendering","in","in2","intercept","k","k1","k2","k3","k4","kerning","keypoints","keysplines","keytimes","lang","lengthadjust","letter-spacing","kernelmatrix","kernelunitlength","lighting-color","local","marker-end","marker-mid","marker-start","markerheight","markerunits","markerwidth","maskcontentunits","maskunits","max","mask","mask-type","media","method","mode","min","name","numoctaves","offset","operator","opacity","order","orient","orientation","origin","overflow","paint-order","path","pathlength","patterncontentunits","patterntransform","patternunits","pointer-events","points","preservealpha","preserveaspectratio","primitiveunits","r","rx","ry","radius","refx","refy","repeatcount","repeatdur","restart","result","rotate","scale","seed","shape-rendering","slope","specularconstant","specularexponent","spreadmethod","startoffset","stddeviation","stitchtiles","stop-color","stop-opacity","stroke-dasharray","stroke-dashoffset","stroke-linecap","stroke-linejoin","stroke-miterlimit","stroke-opacity","stroke","stroke-width","style","surfacescale","systemlanguage","tabindex","tablevalues","targetx","targety","transform","transform-origin","text-anchor","text-decoration","text-orientation","text-rendering","textlength","type","u1","u2","unicode","values","vector-effect","viewbox","visibility","version","vert-adv-y","vert-origin-x","vert-origin-y","width","word-spacing","wrap","writing-mode","xchannelselector","ychannelselector","x","x1","x2","xmlns","y","y1","y2","z","zoomandpan"]),Y4=t1(["accent","accentunder","align","bevelled","close","columnalign","columnlines","columnspacing","columnspan","denomalign","depth","dir","display","displaystyle","encoding","fence","frame","height","href","id","largeop","length","linethickness","lquote","lspace","mathbackground","mathcolor","mathsize","mathvariant","maxsize","minsize","movablelimits","notation","numalign","open","rowalign","rowlines","rowspacing","rowspan","rspace","rquote","scriptlevel","scriptminsize","scriptsizemultiplier","selection","separator","separators","stretchy","subscriptshift","supscriptshift","symmetric","voffset","width","xmlns"]),G5=t1(["xlink:href","xml:id","xlink:title","xml:space","xmlns:xlink"]),N8=M1(/{{[\w\W]*|^[\w\W]*}}/g),I8=M1(/<%[\w\W]*|^[\w\W]*%>/g),W8=M1(/\${[\w\W]*/g),j8=M1(/^data-[\-\w.\u00B7-\uFFFF]+$/),U8=M1(/^aria-[\-\w]+$/),J4=M1(/^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|matrix):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i),G8=M1(/^(?:\w+script|data):/i),q8=M1(/[\u0000-\u0020\u00A0\u1680\u180E\u2000-\u2029\u205F\u3000]/g),K8=M1(/^html$/i),Q8=M1(/^[a-z][.\w]*(-[.\w]+)+$/i),d7=M1(/<[/\w!]/g),C9=M1(/<[/\w]/g),X8=M1(/<\/no(script|embed|frames)/i),H9=M1(/\/>/i),H1={element:1,attribute:2,text:3,cdataSection:4,entityReference:5,entityNode:6,processingInstruction:7,comment:8,document:9,documentType:10,documentFragment:11,notation:12},Y8=t1(_({},["style","script","xmp","iframe","noembed","noframes","plaintext","noscript"])),J8=function(){return typeof window>"u"?null:window},CC=function(V,C){if(typeof V!="object"||typeof V.createPolicy!="function")return null;let H=null,e="data-tt-policy-suffix";C&&C.hasAttribute(e)&&(H=C.getAttribute(e));let L="dompurify"+(H?"#"+H:"");try{return V.createPolicy(L,{createHTML(i){return i},createScriptURL(i){return i}})}catch{return console.warn("TrustedTypes policy "+L+" could not be created."),null}},V9=function(){return{afterSanitizeAttributes:[],afterSanitizeElements:[],afterSanitizeShadowDOM:[],beforeSanitizeAttributes:[],beforeSanitizeElements:[],beforeSanitizeShadowDOM:[],uponSanitizeAttribute:[],uponSanitizeElement:[],uponSanitizeShadowNode:[]}},Q1=function(V,C,H,e){return d1(V,C)&&O2(V[C])?_(e.base?c1(e.base):{},V[C],e.transform):H},A7=function(V,C,H){let e=d1(V,C)?V[C]:void 0;return e&&typeof e=="object"?c1(e):H()};function M9(){let r=arguments.length>0&&arguments[0]!==void 0?arguments[0]:J8(),V=g=>M9(g);if(V.version="3.4.17",V.removed=[],!r||!r.document||r.document.nodeType!==H1.document||!r.Element)return V.isSupported=!1,V;let C=r.document,H=C,e=H.currentScript;r.DocumentFragment;let L=r.HTMLTemplateElement,i=r.Node,M=r.Element,o=r.NodeFilter;r.NamedNodeMap===void 0&&(r.NamedNodeMap||r.MozNamedAttrMap),r.HTMLFormElement;let l=r.DOMParser,a=r.trustedTypes,m=M.prototype,c=u1(m,"cloneNode"),u=u1(m,"remove"),b=u1(m,"removeAttributeNode"),x=u1(m,"nextSibling"),f=u1(m,"childNodes"),w=u1(m,"parentNode"),J=u1(m,"shadowRoot"),p1=u1(m,"attributes"),y1=i&&i.prototype?u1(i.prototype,"nodeType"):null,W1=i&&i.prototype?u1(i.prototype,"nodeName"):null,j1=i&&i.prototype?u1(i.prototype,"ownerDocument"):null,L1=function(n){return y1?y1(n):n.nodeType},N2=function(n){return W1?W1(n):n.nodeName},k7=R8(m,"namespaceURI"),l0=function(n){return k7?k7(n):n.namespaceURI};if(typeof L=="function"){let g=C.createElement("template");g.content&&g.content.ownerDocument&&(C=g.content.ownerDocument)}let n1,H2="",d0,y7=!1,I2=0,w7=function(){if(I2>0)throw N1('A configured TRUSTED_TYPES_POLICY callback (createHTML or createScriptURL) must not call DOMPurify.sanitize, as that causes infinite recursion. Do not pass a policy whose callbacks wrap DOMPurify as TRUSTED_TYPES_POLICY; see the "DOMPurify and Trusted Types" section of the README.')},c2=function(n){w7(),I2++;try{return n1.createHTML(n)}finally{I2--}},K9=function(n){w7(),I2++;try{return n1.createScriptURL(n)}finally{I2--}},Q9=function(){return y7||(d0=CC(a,e),y7=!0),d0},g5=C,A0=g5.implementation,O7=g5.createNodeIterator,X9=g5.createDocumentFragment,Y9=g5.getElementsByTagName,J9=H.importNode,U=V9();V.isSupported=typeof e9=="function"&&typeof w=="function"&&A0&&A0.createHTMLDocument!==void 0;let C6=N8,H6=I8,V6=W8,e6=j8,L6=U8,t6=G8,$7=q8,r6=Q8,T7=J4,q=null,p0=_({},[...K4,...o7,...n7,...s7,...Q4]),K=null,m0=_({},[...X4,...l7,...Y4,...G5]),w1=Object.seal(w2(null,{tagNameCheck:{writable:!0,configurable:!1,enumerable:!0,value:null},attributeNameCheck:{writable:!0,configurable:!1,enumerable:!0,value:null},allowCustomizedBuiltInElements:{writable:!0,configurable:!1,enumerable:!0,value:!1}})),W2=null,P7=null,U1=Object.seal(w2(null,{tagCheck:{writable:!0,configurable:!1,enumerable:!0,value:null},attributeCheck:{writable:!0,configurable:!1,enumerable:!0,value:null}})),B7=!0,c0=!0,_7=!1,v0=!0,R1=!1,V2=!0,e2=!1,u0=!1,f5=null,b5=null,x0=!1,v2=!1,k5=!1,y5=!1,E7=!0,R7=!1,F7="user-content-",h0=!0,Z0=!1,L2=null,u2={},t2=null,D7=_({},["annotation-xml","audio","colgroup","desc","foreignobject","head","iframe","math","mi","mn","mo","ms","mtext","noembed","noframes","noscript","plaintext","script","selectedcontent","style","svg","template","thead","title","video","xmp"]),z7=null,N7=_({},["audio","video","img","source","image","track"]),I7=null,W7=_({},["alt","class","for","id","label","name","pattern","placeholder","role","summary","title","value","style","xmlns"]),w5="http://www.w3.org/1998/Math/MathML",O5="http://www.w3.org/2000/svg",O1="http://www.w3.org/1999/xhtml",x2=O1,S0=!1,g0=null,i6=_({},[w5,O5,O1],a7),j7=t1(["mi","mo","mn","ms","mtext"]),f0=_({},j7),U7=t1(["annotation-xml"]),b0=_({},U7),M6=_({},["title","style","font","a","script"]),j2=null,a6=["application/xhtml+xml","text/html"],o6="text/html",Y=null,h2=null,n6=C.createElement("form"),G7=function(n){return n instanceof RegExp||n instanceof Function},k0=function(){let n=arguments.length>0&&arguments[0]!==void 0?arguments[0]:{};if(h2&&h2===n)return;(!n||typeof n!="object")&&(n={}),n=c1(n),j2=a6.indexOf(n.PARSER_MEDIA_TYPE)===-1?o6:n.PARSER_MEDIA_TYPE,Y=j2==="application/xhtml+xml"?a7:l2,q=Q1(n,"ALLOWED_TAGS",p0,{transform:Y}),K=Q1(n,"ALLOWED_ATTR",m0,{transform:Y}),g0=Q1(n,"ALLOWED_NAMESPACES",i6,{transform:a7}),I7=Q1(n,"ADD_URI_SAFE_ATTR",W7,{transform:Y,base:W7}),z7=Q1(n,"ADD_DATA_URI_TAGS",N7,{transform:Y,base:N7}),t2=Q1(n,"FORBID_CONTENTS",D7,{transform:Y}),W2=Q1(n,"FORBID_TAGS",c1({}),{transform:Y}),P7=Q1(n,"FORBID_ATTR",c1({}),{transform:Y}),u2=d1(n,"USE_PROFILES")?n.USE_PROFILES&&typeof n.USE_PROFILES=="object"?c1(n.USE_PROFILES):n.USE_PROFILES:!1,B7=n.ALLOW_ARIA_ATTR!==!1,c0=n.ALLOW_DATA_ATTR!==!1,_7=n.ALLOW_UNKNOWN_PROTOCOLS||!1,v0=n.ALLOW_SELF_CLOSE_IN_ATTR!==!1,R1=n.SAFE_FOR_TEMPLATES||!1,V2=n.SAFE_FOR_XML!==!1,e2=n.WHOLE_DOCUMENT||!1,v2=n.RETURN_DOM||!1,k5=n.RETURN_DOM_FRAGMENT||!1,y5=n.RETURN_TRUSTED_TYPE||!1,x0=n.FORCE_BODY||!1,E7=n.SANITIZE_DOM!==!1,R7=n.SANITIZE_NAMED_PROPS||!1,h0=n.KEEP_CONTENT!==!1,Z0=n.IN_PLACE||!1,T7=F8(n.ALLOWED_URI_REGEXP)?n.ALLOWED_URI_REGEXP:J4,x2=typeof n.NAMESPACE=="string"?n.NAMESPACE:O1,f0=A7(n,"MATHML_TEXT_INTEGRATION_POINTS",()=>_({},j7)),b0=A7(n,"HTML_INTEGRATION_POINTS",()=>_({},U7));let v=A7(n,"CUSTOM_ELEMENT_HANDLING",()=>w2(null));if(w1=w2(null),d1(v,"tagNameCheck")&&G7(v.tagNameCheck)&&(w1.tagNameCheck=v.tagNameCheck),d1(v,"attributeNameCheck")&&G7(v.attributeNameCheck)&&(w1.attributeNameCheck=v.attributeNameCheck),d1(v,"allowCustomizedBuiltInElements")&&typeof v.allowCustomizedBuiltInElements=="boolean"&&(w1.allowCustomizedBuiltInElements=v.allowCustomizedBuiltInElements),M1(w1),R1&&(c0=!1),k5&&(v2=!0),u2&&(q=_({},Q4),K=w2(null),u2.html===!0&&(_(q,K4),_(K,X4)),u2.svg===!0&&(_(q,o7),_(K,l7),_(K,G5)),u2.svgFilters===!0&&(_(q,n7),_(K,l7),_(K,G5)),u2.mathMl===!0&&(_(q,s7),_(K,Y4),_(K,G5))),U1.tagCheck=null,U1.attributeCheck=null,d1(n,"ADD_TAGS")&&(typeof n.ADD_TAGS=="function"?U1.tagCheck=n.ADD_TAGS:O2(n.ADD_TAGS)&&(q===p0&&(q=c1(q)),_(q,n.ADD_TAGS,Y))),d1(n,"ADD_ATTR")&&(typeof n.ADD_ATTR=="function"?U1.attributeCheck=n.ADD_ATTR:O2(n.ADD_ATTR)&&(K===m0&&(K=c1(K)),_(K,n.ADD_ATTR,Y))),d1(n,"ADD_FORBID_CONTENTS")&&O2(n.ADD_FORBID_CONTENTS)&&(t2===D7&&(t2=c1(t2)),_(t2,n.ADD_FORBID_CONTENTS,Y)),h0&&(q["#text"]=!0),e2&&_(q,["html","head","body"]),q.table&&(_(q,["tbody"]),delete W2.tbody),n.TRUSTED_TYPES_POLICY){if(typeof n.TRUSTED_TYPES_POLICY.createHTML!="function")throw N1('TRUSTED_TYPES_POLICY configuration option must provide a "createHTML" hook.');if(typeof n.TRUSTED_TYPES_POLICY.createScriptURL!="function")throw N1('TRUSTED_TYPES_POLICY configuration option must provide a "createScriptURL" hook.');let Z=n1;n1=n.TRUSTED_TYPES_POLICY;try{H2=c2("")}catch(S){throw n1=Z,S}}else n.TRUSTED_TYPES_POLICY===null?(n1=void 0,H2=""):(n1===void 0&&(n1=Q9()),n1&&typeof H2=="string"&&(H2=c2("")));t1&&t1(n),h2=n},q7=_({},[...o7,...n7,...D8]),K7=_({},[...s7,...z8]),s6=function(n,v,Z){return v.namespaceURI===O1?n==="svg":v.namespaceURI===w5?n==="svg"&&(Z==="annotation-xml"||f0[Z]):!!q7[n]},l6=function(n,v,Z){return v.namespaceURI===O1?n==="math":v.namespaceURI===O5?n==="math"&&b0[Z]:!!K7[n]},d6=function(n,v,Z){return v.namespaceURI===O5&&!b0[Z]||v.namespaceURI===w5&&!f0[Z]?!1:!K7[n]&&(M6[n]||!q7[n])},A6=function(n){let v=l0(n),Z=l2(N2(n)),S=w(n),y,$;return S&&L1(S)===H1.element?(y={namespaceURI:l0(S)},$=l2(N2(S))):(y={namespaceURI:x2},$="template"),g0[v]?v===O5?s6(Z,y,$):v===w5?l6(Z,y,$):v===O1?d6(Z,y,$):!!(j2==="application/xhtml+xml"&&g0[v]):!1},G1=function(n){a5(V.removed,{element:n});try{w(n).removeChild(n)}catch{if(u(n),!w(n))throw N1("a node selected for removal could not be detached from its tree and cannot be safely returned; refusing to sanitize in place")}},Q7=function(n,v,Z){try{b(n,v)}catch{try{n.removeAttribute(Z)}catch{}}},y0=function(n){O0(n);let v=f(n);v&&z1(O8(v),S=>{try{u(S)}catch{}});let Z=L1(n)===H1.element?p1(n):null;if(Z)for(let S=Z.length-1;S>=0;--S){let y=Z[S],$=y&&y.name;typeof $=="string"&&Q7(n,y,$)}},Z2=function(n,v,Z){if(!Z)try{Z=v.getAttributeNode(n)}catch{Z=null}a5(V.removed,{attribute:Z||null,from:v});try{Z?b(v,Z):v.removeAttribute(n)}catch{try{v.removeAttribute(n)}catch{}}if(n==="is")if(v2||k5)try{G1(v)}catch{}else try{v.setAttribute(n,"")}catch{}},X7=function(n){let v=p1(n);if(v)for(let Z=v.length-1;Z>=0;--Z){let S=v[Z],y=S&&S.name;typeof y!="string"||K[Y(y)]||Q7(n,S,y)}},w0=function(n,v){let Z=arguments.length>2&&arguments[2]!==void 0?arguments[2]:!1,S=[n];for(;S.length>0;){let y=S.pop();if(v(y)===!1)continue;if(Z&&L1(y)===H1.element){let P=J(y);q1(P)&&S.push(P)}let $=f(y);if($)for(let P=$.length-1;P>=0;--P)S.push($[P])}},O0=function(n){w0(n,v=>{L1(v)===H1.element&&X7(v)})},$0=function(n){let v=[];return w0(n,Z=>{v.push(Z)},!0),v},p6=function(n,v){let Z=i7();z1($0(n),S=>{L1(S)===H1.element&&M7(Z,S)}),z1(v,S=>{L1(S)===H1.element&&!o5(Z,S)&&X7(S)})},Y7=function(n,v){let Z=!1;return z1(V.removed,S=>{S.element&&(Z=Z||S.element===n,O0(S.element))}),p6(n,v),Z},m6=8,c6=function(n,v){let Z=L2,S=null,y=()=>(S||(S=i7(),z1(v,$=>{M7(S,$)})),S);for(let $=0;;$++){let P=$0(n),V1=[n],$1=!1;if(z1(P,o1=>{L1(o1)===H1.documentFragment?a5(V1,o1):!$1&&!o5(Z,o1)&&($1=o5(y(),o1))}),!$1)return;if($>=m6)throw N1("the tree kept changing during in-place sanitization; refusing to return it");z1(V1,(o1,s1)=>{v6(o1,s1>0,n,y())})}},v6=function(n,v,Z,S){let y=T0(n),$;for(;$=y.nextNode();)!o5(S,$)||o5(L2,$)||(v&&S1(U.uponSanitizeShadowNode,$,null),B0($,Z),_0($,Z),q1($.content)&&G2($.content))},u6=function(n){L2&&M7(L2,n)},J7=function(n,v){return V2?n==="patchsrc"?!0:n==="for"&&v!=="label"&&v!=="output":!1},x6=function(n){V2&&w0(n,v=>{let Z=L1(v);if(Z===H1.processingInstruction||Z===H1.comment&&i1(C9,v.data)){try{u(v)}catch{}return!1}if(Z===H1.element){let S=v,y=Y(N2(v));try{S.hasAttribute&&S.hasAttribute("patchsrc")&&S.removeAttribute("patchsrc"),S.hasAttribute&&S.hasAttribute("for")&&J7("for",y)&&S.removeAttribute("for")}catch{}}return!0})},C4=function(n){let v=null,Z=null;if(x0)n="<remove></remove>"+n;else{let $=j4(n,/^[\r\n\t ]+/);Z=$&&$[0]}j2==="application/xhtml+xml"&&x2===O1&&(n='<html xmlns="http://www.w3.org/1999/xhtml"><head></head><body>'+n+"</body></html>");let S=n1?c2(n):n;if(x2===O1)try{v=new l().parseFromString(S,j2)}catch{}if(!v||!v.documentElement){v=A0.createDocument(x2,"template",null);try{v.documentElement.innerHTML=S0?H2:S}catch{}}let y=v.body||v.documentElement;return n&&Z&&y.insertBefore(C.createTextNode(Z),y.childNodes[0]||null),x2===O1?Y9.call(v,e2?"html":"body")[0]:e2?v.documentElement:y},T0=function(n){let v=j1?j1(n):n.ownerDocument;return O7.call(v||n,n,o.SHOW_ELEMENT|o.SHOW_COMMENT|o.SHOW_TEXT|o.SHOW_PROCESSING_INSTRUCTION|o.SHOW_CDATA_SECTION,null)},$5=function(n){return n=n5(n,C6," "),n=n5(n,H6," "),n=n5(n,V6," "),n},P0=function(n){var v;H4(n);let Z=(v=n.querySelectorAll)===null||v===void 0?void 0:v.call(n,"template");Z&&z1(Z,S=>{q1(S.content)&&P0(S.content)})},H4=function(n){n.normalize();let v=j1?j1(n):n.ownerDocument,Z=O7.call(v||n,n,o.SHOW_TEXT|o.SHOW_COMMENT|o.SHOW_CDATA_SECTION|o.SHOW_PROCESSING_INSTRUCTION,null),S=Z.nextNode();for(;S;)S.data=$5(S.data),S=Z.nextNode()},T5=function(n){let v=W1?W1(n):null;return typeof v!="string"||Y(v)!=="form"?!1:typeof n.nodeName!="string"||typeof n.textContent!="string"||typeof n.removeChild!="function"||n.attributes!==p1(n)||typeof n.removeAttribute!="function"||typeof n.removeAttributeNode!="function"||typeof n.getAttributeNode!="function"||typeof n.setAttribute!="function"||typeof n.namespaceURI!="string"||typeof n.insertBefore!="function"||typeof n.hasChildNodes!="function"||n.nodeType!==y1(n)||n.childNodes!==f(n)},q1=function(n){if(!y1||typeof n!="object"||n===null)return!1;try{return y1(n)===H1.documentFragment}catch{return!1}},U2=function(n){if(!y1||typeof n!="object"||n===null)return!1;try{return typeof y1(n)=="number"}catch{return!1}};function S1(g,n,v){g.length!==0&&z1(g,Z=>{Z.call(V,n,v,h2)})}let h6=function(n,v){return!!(V2&&n.hasChildNodes()&&!U2(n.firstElementChild)&&i1(d7,n.textContent)&&i1(d7,n.innerHTML)||V2&&Y8[v]&&L1(n)===H1.element&&l0(n)===O1&&(U2(n.firstElementChild)||typeof n.textContent=="string"&&i1(d7,n.textContent))||n.nodeType===H1.processingInstruction||V2&&n.nodeType===H1.comment&&i1(C9,n.data))},P5=function(n,v){if(n instanceof RegExp)return i1(n,v);if(n instanceof Function){for(var Z=arguments.length,S=new Array(Z>2?Z-2:0),y=2;y<Z;y++)S[y-2]=arguments[y];return!!n(v,...S)}return!1},Z6=function(n,v,Z){if(!W2[v]&&L4(v)&&P5(w1.tagNameCheck,v))return!1;if(h0&&!t2[v]&&!t2[l2(v)]){let S=w(n),y=f(n);if(y&&S){let $=y.length;for(let P=$-1;P>=0;--P){let V1=n===Z?c(y[P],!0):y[P];S.insertBefore(V1,x(n))}}}return G1(n),!0},V4=function(n,v,Z,S){return n.length===0?v:v===Z||v===S?c1(v):v},S2=function(n,v){return n===v||w(n)!==null?!1:(Z0&&O0(n),!0)},B0=function(n,v){if(u6(n),S1(U.beforeSanitizeElements,n,null),S2(n,v))return!0;if(T5(n))return G1(n),!0;let Z=Y(N2(n));if(q=V4(U.uponSanitizeElement,q,p0,f5),S1(U.uponSanitizeElement,n,{tagName:Z,allowedTags:q}),S2(n,v))return!0;if(h6(n,Z))return G1(n),!0;if(W2[Z]||!(U1.tagCheck instanceof Function&&U1.tagCheck(Z))&&!q[Z]){let S=Z6(n,Z,v);return S===!1&&(S1(U.afterSanitizeElements,n,null),S2(n,v))?!0:S}if(L1(n)===H1.element&&!A6(n)||(Z==="noscript"||Z==="noembed"||Z==="noframes")&&i1(X8,n.innerHTML))return G1(n),!0;if(R1&&n.nodeType===H1.text){let S=$5(n.textContent);n.textContent!==S&&(a5(V.removed,{element:n.cloneNode()}),n.textContent=S)}return S1(U.afterSanitizeElements,n,null),S2(n,v)},e4=function(n,v,Z){if(P7[v]||J7(v,n)||E7&&(v==="id"||v==="name")&&(Z in C||Z in n6))return!1;let S=K[v]||U1.attributeCheck instanceof Function&&U1.attributeCheck(v,n);return c0&&i1(e6,v)||B7&&i1(L6,v)?!0:S?I7[v]||i1(T7,n5(Z,$7,""))||(v==="src"||v==="xlink:href"||v==="href")&&n!=="script"&&U4(Z,"data:")===0&&z7[n]||_7&&!i1(t6,n5(Z,$7,""))?!0:!Z:L4(n)&&P5(w1.tagNameCheck,n)&&P5(w1.attributeNameCheck,v,n)||v==="is"&&w1.allowCustomizedBuiltInElements&&P5(w1.tagNameCheck,Z)},S6=_({},["annotation-xml","color-profile","font-face","font-face-format","font-face-name","font-face-src","font-face-uri","missing-glyph"]),L4=function(n){return!S6[l2(n)]&&i1(r6,n)},g6=function(n,v,Z,S){if(n1&&typeof a=="object"&&typeof a.getAttributeType=="function"&&!Z)switch(a.getAttributeType(n,v)){case"TrustedHTML":return c2(S);case"TrustedScriptURL":return K9(S)}return S},f6=function(n,v,Z,S){try{return Z?n.setAttributeNS(Z,v,S):n.setAttribute(v,S),T5(n)?(G1(n),!1):!0}catch{return Z2(v,n),!1}},t4=function(n,v){return V2&&i1(/((--!?|])>)|<\/(style|script|title|xmp|textarea|noscript|iframe|noembed|noframes)/i,v)?!0:l2(n)==="attributename"&&j4(v,"href")!==null},_0=function(n,v){if(S1(U.beforeSanitizeAttributes,n,null),S2(n,v))return;let Z=n.attributes;if(!Z||T5(n))return;K=V4(U.uponSanitizeAttribute,K,m0,b5);let S={attrName:"",attrValue:"",keepAttr:!0,allowedAttributes:K,forceKeepAttr:void 0},y=Z.length,$=Y(n.nodeName);for(;y--;){let P=Z[y],V1=P.name,$1=P.namespaceURI,o1=P.value,s1=Y(V1),g2=o1,l1=V1==="value"?g2:T8(g2),r4=!1;if(S.attrName=s1,S.attrValue=l1,S.keepAttr=!0,S.forceKeepAttr=void 0,S1(U.uponSanitizeAttribute,n,S),l1=S.attrValue,R7&&(s1==="id"||s1==="name")&&U4(l1,F7)!==0&&(Z2(V1,n,P),l1=F7+l1,r4=!0),t4(V1,l1)){Z2(V1,n,P);continue}if(!S.forceKeepAttr){if(!S.keepAttr){Z2(V1,n,P);continue}if(!v0&&i1(H9,l1)){Z2(V1,n,P);continue}if(R1&&(l1=$5(l1)),!e4($,s1,l1)){Z2(V1,n,P);continue}l1=g6($,s1,$1,l1),l1!==g2&&f6(n,V1,$1,l1)&&r4&&W4(V.removed)}}S1(U.afterSanitizeAttributes,n,null),S2(n,v)},G2=function(n){let v=null,Z=T0(n);for(S1(U.beforeSanitizeShadowDOM,n,null);v=Z.nextNode();)if(S1(U.uponSanitizeShadowNode,v,null),B0(v,n),_0(v,n),q1(v.content)&&G2(v.content),L1(v)===H1.element){let S=J(v);q1(S)&&(E0(S),G2(S))}R1&&H4(n),S1(U.afterSanitizeShadowDOM,n,null)},E0=function(n){let v=[{node:n,shadow:null}];for(;v.length>0;){let Z=v.pop();if(Z.shadow){G2(Z.shadow);continue}let S=Z.node,y=L1(S)===H1.element,$=f(S);if($)for(let P=$.length-1;P>=0;--P)v.push({node:$[P],shadow:null});if(y){let P=W1?W1(S):null;if(typeof P=="string"&&Y(P)==="template"){let V1=S.content;q1(V1)&&v.push({node:V1,shadow:null})}}if(y){let P=J(S);q1(P)&&v.push({node:null,shadow:P},{node:P,shadow:null})}}};return V.sanitize=function(g){let n=arguments.length>1&&arguments[1]!==void 0?arguments[1]:{},v=null,Z=null,S=null,y=null;if(S0=!g,S0&&(g="<!-->"),typeof g!="string"&&!U2(g)&&(g=E8(g),typeof g!="string"))throw N1("dirty is not a string, aborting");if(!V.isSupported)return g;u0?(q=f5,K=b5):k0(n),(U.uponSanitizeElement.length>0||U.uponSanitizeAttribute.length>0)&&(q=c1(q)),U.uponSanitizeAttribute.length>0&&(K=c1(K)),V.removed=[];let $=Z0&&typeof g!="string"&&U2(g),P=[],V1=L2;if($){x6(g);let s1=N2(g);if(typeof s1=="string"){let g2=Y(s1);if(!q[g2]||W2[g2])throw y0(g),N1("root node is forbidden and cannot be sanitized in-place")}if(T5(g))throw y0(g),N1("root node is clobbered and cannot be sanitized in-place");P=$0(g),L2=i7()}else if(U2(g))v=C4("<!---->"),Z=v.ownerDocument.importNode(g,!0),Z.nodeType===H1.element&&Z.nodeName==="BODY"||Z.nodeName==="HTML"?v=Z:v.appendChild(Z),E0(v);else{if(!v2&&!R1&&!e2&&g.indexOf("<")===-1)return n1&&y5?c2(g):g;if(v=C4(g),!v)return v2?null:y5?H2:""}v&&x0&&G1(v.firstChild);let $1=$?g:v;try{$&&E0(g);let s1=T0($1);for(;S=s1.nextNode();)B0(S,$1),_0(S,$1),q1(S.content)&&G2(S.content);$&&c6(g,P)}catch(s1){throw $&&(y0(g),Y7(g,P)),s1}finally{L2=V1}if($){if(Y7(g,P))throw N1("a node selected for removal could not be safely returned; refusing to sanitize in place");return R1&&P0(g),g}if(v2){if(R1&&P0(v),k5)for(y=X9.call(v.ownerDocument);v.firstChild;)y.appendChild(v.firstChild);else y=v;return(K.shadowroot||K.shadowrootmode)&&(y=J9.call(H,y,!0)),y}let o1=e2?v.outerHTML:v.innerHTML;return e2&&q["!doctype"]&&v.ownerDocument&&v.ownerDocument.doctype&&v.ownerDocument.doctype.name&&i1(K8,v.ownerDocument.doctype.name)&&(o1="<!DOCTYPE "+v.ownerDocument.doctype.name+`>
`+o1),R1&&(o1=$5(o1)),n1&&y5?c2(o1):o1},V.setConfig=function(){let g=arguments.length>0&&arguments[0]!==void 0?arguments[0]:{};k0(g),u0=!0,f5=q,b5=K},V.clearConfig=function(){h2=null,u0=!1,f5=null,b5=null,n1=d0,H2=""},V.isValidAttribute=function(g,n,v){h2||k0({});let Z=Y(g),S=Y(n);return typeof v=="string"&&(t4(n,v)||!v0&&i1(H9,v))?!1:e4(Z,S,v)},V.addHook=function(g,n){typeof n=="function"&&d1(U,g)&&a5(U[g],n)},V.removeHook=function(g,n){if(d1(U,g)){if(n!==void 0){let v=w8(U[g],n);return v===-1?void 0:$8(U[g],v,1)[0]}return W4(U[g])}},V.removeHooks=function(g){d1(U,g)&&(U[g]=[])},V.removeAllHooks=function(){U=V9()},V}var c7=M9();var v7={};y6(v7,{mdiAccountBoxOutline:()=>q5,mdiAccountOutline:()=>K5,mdiAlertCircleOutline:()=>Q5,mdiApi:()=>a9,mdiArrowDown:()=>X5,mdiArrowUp:()=>l5,mdiBellOffOutline:()=>Y5,mdiBellOutline:()=>J5,mdiBellRingOutline:()=>o9,mdiCalendarClockOutline:()=>C3,mdiCalendarEdit:()=>H3,mdiCalendarMonthOutline:()=>n9,mdiCalendarPlus:()=>V3,mdiCalendarSyncOutline:()=>s9,mdiChartLine:()=>l9,mdiChatOutline:()=>e3,mdiChatProcessingOutline:()=>d9,mdiCheck:()=>L3,mdiChevronDown:()=>t3,mdiChevronLeft:()=>r3,mdiChevronRight:()=>i3,mdiCircleOutline:()=>A9,mdiClockOutline:()=>M3,mdiClose:()=>a3,mdiCloudDownloadOutline:()=>p9,mdiCloudOutline:()=>o3,mdiCloudUploadOutline:()=>m9,mdiCogOutline:()=>n3,mdiConsoleNetworkOutline:()=>c9,mdiContentCopy:()=>s3,mdiCreationOutline:()=>l3,mdiCurrencyEur:()=>d3,mdiDatabaseImportOutline:()=>A3,mdiDockLeft:()=>p3,mdiDockRight:()=>m3,mdiDotsHorizontal:()=>c3,mdiDownload:()=>v3,mdiEmailEditOutline:()=>v9,mdiEmailOpenOutline:()=>u9,mdiEmailOutline:()=>x9,mdiEmailSearchOutline:()=>h9,mdiEyeOffOutline:()=>u3,mdiEyeOutline:()=>x3,mdiFileDocumentOutline:()=>h3,mdiFileEditOutline:()=>Z9,mdiFileEyeOutline:()=>S9,mdiFolderNetworkOutline:()=>g9,mdiFolderOutline:()=>Z3,mdiFormatListChecks:()=>S3,mdiGauge:()=>g3,mdiHammerWrench:()=>f3,mdiHeadLightbulbOutline:()=>b3,mdiHelpCircleOutline:()=>k3,mdiHomeAssistant:()=>f9,mdiHomeOutline:()=>y3,mdiHomeSearchOutline:()=>b9,mdiImageOutline:()=>w3,mdiInformationOutline:()=>O3,mdiKeyOutline:()=>$3,mdiLockOutline:()=>T3,mdiMagnify:()=>P3,mdiMenu:()=>B3,mdiMicrophoneOutline:()=>_3,mdiOpenInNew:()=>E3,mdiPaperclip:()=>R3,mdiPause:()=>F3,mdiPencilOutline:()=>D3,mdiPinOffOutline:()=>z3,mdiPinOutline:()=>N3,mdiPlay:()=>I3,mdiPlayCircleOutline:()=>k9,mdiPlus:()=>W3,mdiProgressClock:()=>j3,mdiRefresh:()=>U3,mdiRobotOutline:()=>G3,mdiSchoolOutline:()=>q3,mdiSendOutline:()=>y9,mdiShareVariantOutline:()=>K3,mdiShieldAccountOutline:()=>Q3,mdiShieldAlertOutline:()=>X3,mdiStop:()=>Y3,mdiTimerSandComplete:()=>J3,mdiToolboxOutline:()=>C0,mdiTools:()=>H0,mdiTrashCanOutline:()=>V0,mdiTuneVariant:()=>w9,mdiUpload:()=>e0,mdiWeb:()=>L0});var q5="M19,19H5V5H19M19,3H5A2,2 0 0,0 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5C21,3.89 20.1,3 19,3M16.5,16.25C16.5,14.75 13.5,14 12,14C10.5,14 7.5,14.75 7.5,16.25V17H16.5M12,12.25A2.25,2.25 0 0,0 14.25,10A2.25,2.25 0 0,0 12,7.75A2.25,2.25 0 0,0 9.75,10A2.25,2.25 0 0,0 12,12.25Z";var K5="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,6A2,2 0 0,0 10,8A2,2 0 0,0 12,10A2,2 0 0,0 14,8A2,2 0 0,0 12,6M12,13C14.67,13 20,14.33 20,17V20H4V17C4,14.33 9.33,13 12,13M12,14.9C9.03,14.9 5.9,16.36 5.9,17V18.1H18.1V17C18.1,16.36 14.97,14.9 12,14.9Z";var Q5="M11,15H13V17H11V15M11,7H13V13H11V7M12,2C6.47,2 2,6.5 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20Z";var a9="M7 7H5A2 2 0 0 0 3 9V17H5V13H7V17H9V9A2 2 0 0 0 7 7M7 11H5V9H7M14 7H10V17H12V13H14A2 2 0 0 0 16 11V9A2 2 0 0 0 14 7M14 11H12V9H14M20 9V15H21V17H17V15H18V9H17V7H21V9Z";var X5="M11,4H13V16L18.5,10.5L19.92,11.92L12,19.84L4.08,11.92L5.5,10.5L11,16V4Z";var l5="M13,20H11V8L5.5,13.5L4.08,12.08L12,4.16L19.92,12.08L18.5,13.5L13,8V20Z";var Y5="M22.11,21.46L2.39,1.73L1.11,3L5.83,7.72C5.29,8.73 5,9.86 5,11V17L3,19V20H18.11L20.84,22.73L22.11,21.46M7,18V11C7,10.39 7.11,9.79 7.34,9.23L16.11,18H7M10,21H14A2,2 0 0,1 12,23A2,2 0 0,1 10,21M8.29,5.09C8.82,4.75 9.4,4.5 10,4.29C10,4.19 10,4.1 10,4A2,2 0 0,1 12,2A2,2 0 0,1 14,4C14,4.1 14,4.19 14,4.29C16.97,5.17 19,7.9 19,11V15.8L17,13.8V11A5,5 0 0,0 12,6C11.22,6 10.45,6.2 9.76,6.56L8.29,5.09Z",J5="M10 21H14C14 22.1 13.1 23 12 23S10 22.1 10 21M21 19V20H3V19L5 17V11C5 7.9 7 5.2 10 4.3V4C10 2.9 10.9 2 12 2S14 2.9 14 4V4.3C17 5.2 19 7.9 19 11V17L21 19M17 11C17 8.2 14.8 6 12 6S7 8.2 7 11V18H17V11Z";var o9="M10,21H14A2,2 0 0,1 12,23A2,2 0 0,1 10,21M21,19V20H3V19L5,17V11C5,7.9 7.03,5.17 10,4.29C10,4.19 10,4.1 10,4A2,2 0 0,1 12,2A2,2 0 0,1 14,4C14,4.1 14,4.19 14,4.29C16.97,5.17 19,7.9 19,11V17L21,19M17,11A5,5 0 0,0 12,6A5,5 0 0,0 7,11V18H17V11M19.75,3.19L18.33,4.61C20.04,6.3 21,8.6 21,11H23C23,8.07 21.84,5.25 19.75,3.19M1,11H3C3,8.6 3.96,6.3 5.67,4.61L4.25,3.19C2.16,5.25 1,8.07 1,11Z";var C3="M6 1V3H5C3.89 3 3 3.89 3 5V19C3 20.1 3.89 21 5 21H11.1C12.36 22.24 14.09 23 16 23C19.87 23 23 19.87 23 16C23 14.09 22.24 12.36 21 11.1V5C21 3.9 20.11 3 19 3H18V1H16V3H8V1M5 5H19V7H5M5 9H19V9.67C18.09 9.24 17.07 9 16 9C12.13 9 9 12.13 9 16C9 17.07 9.24 18.09 9.67 19H5M16 11.15C18.68 11.15 20.85 13.32 20.85 16C20.85 18.68 18.68 20.85 16 20.85C13.32 20.85 11.15 18.68 11.15 16C11.15 13.32 13.32 11.15 16 11.15M15 13V16.69L18.19 18.53L18.94 17.23L16.5 15.82V13Z";var H3="M19,3H18V1H16V3H8V1H6V3H5A2,2 0 0,0 3,5V19A2,2 0 0,0 5,21H10V19H5V8H19V9H21V5A2,2 0 0,0 19,3M21.7,13.35L20.7,14.35L18.65,12.35L19.65,11.35C19.85,11.14 20.19,11.13 20.42,11.35L21.7,12.63C21.89,12.83 21.89,13.15 21.7,13.35M12,18.94L18.07,12.88L20.12,14.88L14.06,21H12V18.94Z";var n9="M7 11H9V13H7V11M21 5V19C21 20.11 20.11 21 19 21H5C3.89 21 3 20.1 3 19V5C3 3.9 3.9 3 5 3H6V1H8V3H16V1H18V3H19C20.11 3 21 3.9 21 5M5 7H19V5H5V7M19 19V9H5V19H19M15 13V11H17V13H15M11 13V11H13V13H11M7 15H9V17H7V15M15 17V15H17V17H15M11 17V15H13V17H11Z";var V3="M19 19V8H5V19H19M16 1H18V3H19C20.11 3 21 3.9 21 5V19C21 20.11 20.11 21 19 21H5C3.89 21 3 20.1 3 19V5C3 3.89 3.89 3 5 3H6V1H8V3H16V1M11 9.5H13V12.5H16V14.5H13V17.5H11V14.5H8V12.5H11V9.5Z";var s9="M18,11V12.5C21.19,12.5 23.09,16.05 21.33,18.71L20.24,17.62C21.06,15.96 19.85,14 18,14V15.5L15.75,13.25L18,11M18,22V20.5C14.81,20.5 12.91,16.95 14.67,14.29L15.76,15.38C14.94,17.04 16.15,19 18,19V17.5L20.25,19.75L18,22M19,3H18V1H16V3H8V1H6V3H5A2,2 0 0,0 3,5V19A2,2 0 0,0 5,21H14C13.36,20.45 12.86,19.77 12.5,19H5V9H19V10.59C19.71,10.7 20.39,10.94 21,11.31V5A2,2 0 0,0 19,3M19,7H5V5H19";var l9="M16,11.78L20.24,4.45L21.97,5.45L16.74,14.5L10.23,10.75L5.46,19H22V21H2V3H4V17.54L9.5,8L16,11.78Z";var e3="M12,3C6.5,3 2,6.58 2,11C2.05,13.15 3.06,15.17 4.75,16.5C4.75,17.1 4.33,18.67 2,21C4.37,20.89 6.64,20 8.47,18.5C9.61,18.83 10.81,19 12,19C17.5,19 22,15.42 22,11C22,6.58 17.5,3 12,3M12,17C7.58,17 4,14.31 4,11C4,7.69 7.58,5 12,5C16.42,5 20,7.69 20,11C20,14.31 16.42,17 12,17Z";var d9="M12 3C6.5 3 2 6.58 2 11C2.05 13.15 3.06 15.17 4.75 16.5C4.75 17.1 4.33 18.67 2 21C4.37 20.89 6.64 20 8.47 18.5C9.61 18.83 10.81 19 12 19C17.5 19 22 15.42 22 11S17.5 3 12 3M12 17C7.58 17 4 14.31 4 11S7.58 5 12 5 20 7.69 20 11 16.42 17 12 17M17 12V10H15V12H17M13 12V10H11V12H13M9 12V10H7V12H9Z";var L3="M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z";var t3="M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z";var r3="M15.41,16.58L10.83,12L15.41,7.41L14,6L8,12L14,18L15.41,16.58Z";var i3="M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z";var A9="M12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z";var M3="M12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22C6.47,22 2,17.5 2,12A10,10 0 0,1 12,2M12.5,7V12.25L17,14.92L16.25,16.15L11,13V7H12.5Z";var a3="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z";var p9="M6.5 20Q4.22 20 2.61 18.43 1 16.85 1 14.58 1 12.63 2.17 11.1 3.35 9.57 5.25 9.15 5.68 7.35 7.38 5.73 9.07 4.1 11 4.1 11.83 4.1 12.41 4.69 13 5.28 13 6.1V12.15L14.6 10.6L16 12L12 16L8 12L9.4 10.6L11 12.15V6.1Q9.1 6.45 8.05 7.94 7 9.43 7 11H6.5Q5.05 11 4.03 12.03 3 13.05 3 14.5 3 15.95 4.03 17 5.05 18 6.5 18H18.5Q19.55 18 20.27 17.27 21 16.55 21 15.5 21 14.45 20.27 13.73 19.55 13 18.5 13H17V11Q17 9.8 16.45 8.76 15.9 7.73 15 7V4.68Q16.85 5.55 17.93 7.26 19 9 19 11 20.73 11.2 21.86 12.5 23 13.78 23 15.5 23 17.38 21.69 18.69 20.38 20 18.5 20M12 11.05Z";var o3="M6.5 20Q4.22 20 2.61 18.43 1 16.85 1 14.58 1 12.63 2.17 11.1 3.35 9.57 5.25 9.15 5.88 6.85 7.75 5.43 9.63 4 12 4 14.93 4 16.96 6.04 19 8.07 19 11 20.73 11.2 21.86 12.5 23 13.78 23 15.5 23 17.38 21.69 18.69 20.38 20 18.5 20M6.5 18H18.5Q19.55 18 20.27 17.27 21 16.55 21 15.5 21 14.45 20.27 13.73 19.55 13 18.5 13H17V11Q17 8.93 15.54 7.46 14.08 6 12 6 9.93 6 8.46 7.46 7 8.93 7 11H6.5Q5.05 11 4.03 12.03 3 13.05 3 14.5 3 15.95 4.03 17 5.05 18 6.5 18M12 12Z";var m9="M6.5 20Q4.22 20 2.61 18.43 1 16.85 1 14.58 1 12.63 2.17 11.1 3.35 9.57 5.25 9.15 5.88 6.85 7.75 5.43 9.63 4 12 4 14.93 4 16.96 6.04 19 8.07 19 11 20.73 11.2 21.86 12.5 23 13.78 23 15.5 23 17.38 21.69 18.69 20.38 20 18.5 20H13Q12.18 20 11.59 19.41 11 18.83 11 18V12.85L9.4 14.4L8 13L12 9L16 13L14.6 14.4L13 12.85V18H18.5Q19.55 18 20.27 17.27 21 16.55 21 15.5 21 14.45 20.27 13.73 19.55 13 18.5 13H17V11Q17 8.93 15.54 7.46 14.08 6 12 6 9.93 6 8.46 7.46 7 8.93 7 11H6.5Q5.05 11 4.03 12.03 3 13.05 3 14.5 3 15.95 4.03 17 5.05 18 6.5 18H9V20M12 13Z";var n3="M12,8A4,4 0 0,1 16,12A4,4 0 0,1 12,16A4,4 0 0,1 8,12A4,4 0 0,1 12,8M12,10A2,2 0 0,0 10,12A2,2 0 0,0 12,14A2,2 0 0,0 14,12A2,2 0 0,0 12,10M10,22C9.75,22 9.54,21.82 9.5,21.58L9.13,18.93C8.5,18.68 7.96,18.34 7.44,17.94L4.95,18.95C4.73,19.03 4.46,18.95 4.34,18.73L2.34,15.27C2.21,15.05 2.27,14.78 2.46,14.63L4.57,12.97L4.5,12L4.57,11L2.46,9.37C2.27,9.22 2.21,8.95 2.34,8.73L4.34,5.27C4.46,5.05 4.73,4.96 4.95,5.05L7.44,6.05C7.96,5.66 8.5,5.32 9.13,5.07L9.5,2.42C9.54,2.18 9.75,2 10,2H14C14.25,2 14.46,2.18 14.5,2.42L14.87,5.07C15.5,5.32 16.04,5.66 16.56,6.05L19.05,5.05C19.27,4.96 19.54,5.05 19.66,5.27L21.66,8.73C21.79,8.95 21.73,9.22 21.54,9.37L19.43,11L19.5,12L19.43,13L21.54,14.63C21.73,14.78 21.79,15.05 21.66,15.27L19.66,18.73C19.54,18.95 19.27,19.04 19.05,18.95L16.56,17.95C16.04,18.34 15.5,18.68 14.87,18.93L14.5,21.58C14.46,21.82 14.25,22 14,22H10M11.25,4L10.88,6.61C9.68,6.86 8.62,7.5 7.85,8.39L5.44,7.35L4.69,8.65L6.8,10.2C6.4,11.37 6.4,12.64 6.8,13.8L4.68,15.36L5.43,16.66L7.86,15.62C8.63,16.5 9.68,17.14 10.87,17.38L11.24,20H12.76L13.13,17.39C14.32,17.14 15.37,16.5 16.14,15.62L18.57,16.66L19.32,15.36L17.2,13.81C17.6,12.64 17.6,11.37 17.2,10.2L19.31,8.65L18.56,7.35L16.15,8.39C15.38,7.5 14.32,6.86 13.12,6.62L12.75,4H11.25Z";var c9="M15,20A1,1 0 0,0 14,19H13V17H17A2,2 0 0,0 19,15V5A2,2 0 0,0 17,3H7A2,2 0 0,0 5,5V15A2,2 0 0,0 7,17H11V19H10A1,1 0 0,0 9,20H2V22H9A1,1 0 0,0 10,23H14A1,1 0 0,0 15,22H22V20H15M7,15V5H17V15H7M8,6.89L11.56,10.45L8,14H10.53L13.45,11.08C13.78,10.74 13.78,10.18 13.45,9.82L10.5,6.89H8M16,12.22H13.33V14H16V12.22Z";var s3="M19,21H8V7H19M19,5H8A2,2 0 0,0 6,7V21A2,2 0 0,0 8,23H19A2,2 0 0,0 21,21V7A2,2 0 0,0 19,5M16,1H4A2,2 0 0,0 2,3V17H4V3H16V1Z";var l3="M9 4L11.5 9.5L17 12L11.5 14.5L9 20L6.5 14.5L1 12L6.5 9.5L9 4M9 8.83L8 11L5.83 12L8 13L9 15.17L10 13L12.17 12L10 11L9 8.83M19 9L17.74 6.26L15 5L17.74 3.75L19 1L20.25 3.75L23 5L20.25 6.26L19 9M19 23L17.74 20.26L15 19L17.74 17.75L19 15L20.25 17.75L23 19L20.25 20.26L19 23Z";var d3="M15 18.5C12.5 18.5 10.32 17.08 9.24 15H15L16 13H8.58C8.53 12.67 8.5 12.34 8.5 12S8.53 11.33 8.58 11H15L16 9H9.24C10.32 6.92 12.5 5.5 15 5.5C16.61 5.5 18.09 6.09 19.23 7.07L21 5.3C19.41 3.87 17.3 3 15 3C11.08 3 7.76 5.5 6.5 9H3L2 11H6.06C6 11.33 6 11.66 6 12S6 12.67 6.06 13H3L2 15H6.5C7.76 18.5 11.08 21 15 21C17.31 21 19.41 20.13 21 18.7L19.22 16.93C18.09 17.91 16.62 18.5 15 18.5Z";var A3="M8.84 12L3.92 16.92L2.5 15.5L5 13H0V11H5L2.5 8.5L3.92 7.08L8.84 12M12 3C8.59 3 5.68 4.07 4.53 5.57L5 6L6.03 7.07C6 7.05 6 7 6 7C6 6.5 8.13 5 12 5S18 6.5 18 7 15.87 9 12 9C9.38 9 7.58 8.31 6.68 7.72L9.8 10.84C10.5 10.94 11.24 11 12 11C14.39 11 16.53 10.47 18 9.64V12.45C16.7 13.4 14.42 14 12 14C11.04 14 10.1 13.9 9.24 13.73L7.59 15.37C8.91 15.77 10.41 16 12 16C14.28 16 16.39 15.55 18 14.77V17C18 17.5 15.87 19 12 19S6 17.5 6 17V16.96L5 18L4.54 18.43C5.69 19.93 8.6 21 12 21C16.41 21 20 19.21 20 17V7C20 4.79 16.42 3 12 3Z";var p3="M20 4H4A2 2 0 0 0 2 6V18A2 2 0 0 0 4 20H20A2 2 0 0 0 22 18V6A2 2 0 0 0 20 4M20 18H9V6H20Z",m3="M20 4H4A2 2 0 0 0 2 6V18A2 2 0 0 0 4 20H20A2 2 0 0 0 22 18V6A2 2 0 0 0 20 4M15 18H4V6H15Z";var c3="M16,12A2,2 0 0,1 18,10A2,2 0 0,1 20,12A2,2 0 0,1 18,14A2,2 0 0,1 16,12M10,12A2,2 0 0,1 12,10A2,2 0 0,1 14,12A2,2 0 0,1 12,14A2,2 0 0,1 10,12M4,12A2,2 0 0,1 6,10A2,2 0 0,1 8,12A2,2 0 0,1 6,14A2,2 0 0,1 4,12Z";var v3="M5,20H19V18H5M19,9H15V3H9V9H5L12,16L19,9Z";var v9="M19.07 13.88L13 19.94V22H15.06L21.12 15.93M22.7 13.58L21.42 12.3C21.32 12.19 21.18 12.13 21.04 12.13C20.89 12.14 20.75 12.19 20.65 12.3L19.65 13.3L21.7 15.3L22.7 14.3C22.89 14.1 22.89 13.78 22.7 13.58M11 18H4V8L12 13L20 8V10H22V6C22 4.9 21.1 4 20 4H4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20H11V18M20 6L12 11L4 6H20Z";var u9="M21.03 6.29L12 .64L2.97 6.29C2.39 6.64 2 7.27 2 8V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V8C22 7.27 21.61 6.64 21.03 6.29M20 18H4V10L12 15L20 10V18M12 13L4 8L12 3L20 8L12 13Z",x9="M22 6C22 4.9 21.1 4 20 4H4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6M20 6L12 11L4 6H20M20 18H4V8L12 13L20 8V18Z";var h9="M16.5 11C19 11 21 13 21 15.5C21 16.38 20.75 17.21 20.31 17.9L23.39 21L22 22.39L18.88 19.32C18.19 19.75 17.37 20 16.5 20C14 20 12 18 12 15.5S14 11 16.5 11M16.5 13C15.12 13 14 14.12 14 15.5S15.12 18 16.5 18 19 16.88 19 15.5 17.88 13 16.5 13M10.5 18H3V8L10.62 12.76C11.65 10.54 13.9 9 16.5 9C16.77 9 17.04 9 17.31 9.06L19 8V9.5C19.75 9.81 20.42 10.27 21 10.82V6C21 4.9 20.1 4 19 4H3C1.9 4 1 4.9 1 6V18C1 19.1 1.9 20 3 20H11.82C11.27 19.42 10.82 18.75 10.5 18M19 6L11 11L3 6H19Z";var u3="M2,5.27L3.28,4L20,20.72L18.73,22L15.65,18.92C14.5,19.3 13.28,19.5 12,19.5C7,19.5 2.73,16.39 1,12C1.69,10.24 2.79,8.69 4.19,7.46L2,5.27M12,9A3,3 0 0,1 15,12C15,12.35 14.94,12.69 14.83,13L11,9.17C11.31,9.06 11.65,9 12,9M12,4.5C17,4.5 21.27,7.61 23,12C22.18,14.08 20.79,15.88 19,17.19L17.58,15.76C18.94,14.82 20.06,13.54 20.82,12C19.17,8.64 15.76,6.5 12,6.5C10.91,6.5 9.84,6.68 8.84,7L7.3,5.47C8.74,4.85 10.33,4.5 12,4.5M3.18,12C4.83,15.36 8.24,17.5 12,17.5C12.69,17.5 13.37,17.43 14,17.29L11.72,15C10.29,14.85 9.15,13.71 9,12.28L5.6,8.87C4.61,9.72 3.78,10.78 3.18,12Z",x3="M12,9A3,3 0 0,1 15,12A3,3 0 0,1 12,15A3,3 0 0,1 9,12A3,3 0 0,1 12,9M12,4.5C17,4.5 21.27,7.61 23,12C21.27,16.39 17,19.5 12,19.5C7,19.5 2.73,16.39 1,12C2.73,7.61 7,4.5 12,4.5M3.18,12C4.83,15.36 8.24,17.5 12,17.5C15.76,17.5 19.17,15.36 20.82,12C19.17,8.64 15.76,6.5 12,6.5C8.24,6.5 4.83,8.64 3.18,12Z";var h3="M6,2A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2H6M6,4H13V9H18V20H6V4M8,12V14H16V12H8M8,16V18H13V16H8Z";var Z9="M10 20H6V4H13V9H18V12.1L20 10.1V8L14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H10V20M20.2 13C20.3 13 20.5 13.1 20.6 13.2L21.9 14.5C22.1 14.7 22.1 15.1 21.9 15.3L20.9 16.3L18.8 14.2L19.8 13.2C19.9 13.1 20 13 20.2 13M20.2 16.9L14.1 23H12V20.9L18.1 14.8L20.2 16.9Z";var S9="M17,18C17.56,18 18,18.44 18,19C18,19.56 17.56,20 17,20C16.44,20 16,19.56 16,19C16,18.44 16.44,18 17,18M17,15C14.27,15 11.94,16.66 11,19C11.94,21.34 14.27,23 17,23C19.73,23 22.06,21.34 23,19C22.06,16.66 19.73,15 17,15M17,21.5A2.5,2.5 0 0,1 14.5,19A2.5,2.5 0 0,1 17,16.5A2.5,2.5 0 0,1 19.5,19A2.5,2.5 0 0,1 17,21.5M9.27,20H6V4H13V9H18V13.07C18.7,13.15 19.36,13.32 20,13.56V8L14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H10.5C10,21.41 9.59,20.73 9.27,20Z";var g9="M15 20C15 19.45 14.55 19 14 19H13V17H19C20.11 17 21 16.11 21 15V7C21 5.9 20.11 5 19 5H13L11 3H5C3.9 3 3 3.9 3 5V15C3 16.11 3.9 17 5 17H11V19H10C9.45 19 9 19.45 9 20H2V22H9C9 22.55 9.45 23 10 23H14C14.55 23 15 22.55 15 22H22V20H15M5 15V7H19V15H5Z";var Z3="M20,18H4V8H20M20,6H12L10,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V8C22,6.89 21.1,6 20,6Z";var S3="M3,5H9V11H3V5M5,7V9H7V7H5M11,7H21V9H11V7M11,15H21V17H11V15M5,20L1.5,16.5L2.91,15.09L5,17.17L9.59,12.59L11,14L5,20Z";var g3="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12C20,14.4 19,16.5 17.3,18C15.9,16.7 14,16 12,16C10,16 8.2,16.7 6.7,18C5,16.5 4,14.4 4,12A8,8 0 0,1 12,4M14,5.89C13.62,5.9 13.26,6.15 13.1,6.54L11.81,9.77L11.71,10C11,10.13 10.41,10.6 10.14,11.26C9.73,12.29 10.23,13.45 11.26,13.86C12.29,14.27 13.45,13.77 13.86,12.74C14.12,12.08 14,11.32 13.57,10.76L13.67,10.5L14.96,7.29L14.97,7.26C15.17,6.75 14.92,6.17 14.41,5.96C14.28,5.91 14.15,5.89 14,5.89M10,6A1,1 0 0,0 9,7A1,1 0 0,0 10,8A1,1 0 0,0 11,7A1,1 0 0,0 10,6M7,9A1,1 0 0,0 6,10A1,1 0 0,0 7,11A1,1 0 0,0 8,10A1,1 0 0,0 7,9M17,9A1,1 0 0,0 16,10A1,1 0 0,0 17,11A1,1 0 0,0 18,10A1,1 0 0,0 17,9Z";var f3="M13.78 15.3L19.78 21.3L21.89 19.14L15.89 13.14L13.78 15.3M17.5 10.1C17.11 10.1 16.69 10.05 16.36 9.91L4.97 21.25L2.86 19.14L10.27 11.74L8.5 9.96L7.78 10.66L6.33 9.25V12.11L5.63 12.81L2.11 9.25L2.81 8.55H5.62L4.22 7.14L7.78 3.58C8.95 2.41 10.83 2.41 12 3.58L9.89 5.74L11.3 7.14L10.59 7.85L12.38 9.63L14.2 7.75C14.06 7.42 14 7 14 6.63C14 4.66 15.56 3.11 17.5 3.11C18.09 3.11 18.61 3.25 19.08 3.53L16.41 6.2L17.91 7.7L20.58 5.03C20.86 5.5 21 6 21 6.63C21 8.55 19.45 10.1 17.5 10.1Z";var b3="M13 3C16.9 3 20 6.1 20 10C20 12.8 18.4 15.2 16 16.3V21H9V18H8C6.9 18 6 17.1 6 16V13H4.5C4.1 13 3.8 12.5 4.1 12.2L6 9.7C6.2 5.9 9.2 3 13 3M13 1C8.4 1 4.6 4.4 4.1 8.9L2.5 11C1.9 11.8 1.9 12.8 2.3 13.6C2.7 14.3 3.3 14.8 4 14.9V16C4 17.9 5.3 19.4 7 19.9V23H18V17.5C20.5 15.8 22 13.1 22 10C22 5 18 1 13 1M14 14H12V13H14V14M15.6 9.5C15.3 9.9 15 10.3 14.5 10.6V12H11.5V10.6C10.1 9.8 9.6 7.9 10.4 6.5S13.1 4.6 14.5 5.4 16.4 8.1 15.6 9.5Z";var k3="M11,18H13V16H11V18M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,20C7.59,20 4,16.41 4,12C4,7.59 7.59,4 12,4C16.41,4 20,7.59 20,12C20,16.41 16.41,20 12,20M12,6A4,4 0 0,0 8,10H10A2,2 0 0,1 12,8A2,2 0 0,1 14,10C14,12 11,11.75 11,15H13C13,12.75 16,12.5 16,10A4,4 0 0,0 12,6Z";var f9="M21.8,13H20V21H13V17.67L15.79,14.88L16.5,15C17.66,15 18.6,14.06 18.6,12.9C18.6,11.74 17.66,10.8 16.5,10.8A2.1,2.1 0 0,0 14.4,12.9L14.5,13.61L13,15.13V9.65C13.66,9.29 14.1,8.6 14.1,7.8A2.1,2.1 0 0,0 12,5.7A2.1,2.1 0 0,0 9.9,7.8C9.9,8.6 10.34,9.29 11,9.65V15.13L9.5,13.61L9.6,12.9A2.1,2.1 0 0,0 7.5,10.8A2.1,2.1 0 0,0 5.4,12.9A2.1,2.1 0 0,0 7.5,15L8.21,14.88L11,17.67V21H4V13H2.25C1.83,13 1.42,13 1.42,12.79C1.43,12.57 1.85,12.15 2.28,11.72L11,3C11.33,2.67 11.67,2.33 12,2.33C12.33,2.33 12.67,2.67 13,3L17,7V6H19V9L21.78,11.78C22.18,12.18 22.59,12.59 22.6,12.8C22.6,13 22.2,13 21.8,13M7.5,12A0.9,0.9 0 0,1 8.4,12.9A0.9,0.9 0 0,1 7.5,13.8A0.9,0.9 0 0,1 6.6,12.9A0.9,0.9 0 0,1 7.5,12M16.5,12C17,12 17.4,12.4 17.4,12.9C17.4,13.4 17,13.8 16.5,13.8A0.9,0.9 0 0,1 15.6,12.9A0.9,0.9 0 0,1 16.5,12M12,6.9C12.5,6.9 12.9,7.3 12.9,7.8C12.9,8.3 12.5,8.7 12,8.7C11.5,8.7 11.1,8.3 11.1,7.8C11.1,7.3 11.5,6.9 12,6.9Z";var y3="M12 5.69L17 10.19V18H15V12H9V18H7V10.19L12 5.69M12 3L2 12H5V20H11V14H13V20H19V12H22";var b9="M19.31 18.9C19.75 18.21 20 17.38 20 16.5C20 14 18 12 15.5 12S11 14 11 16.5 13 21 15.5 21C16.37 21 17.19 20.75 17.88 20.32L21 23.39L22.39 22L19.31 18.9M15.5 19C14.12 19 13 17.88 13 16.5S14.12 14 15.5 14 18 15.12 18 16.5 16.88 19 15.5 19M5 20V12H2L12 3L22 12H20.18C19.33 11.11 18.23 10.47 17 10.18L12 5.69L7 10.19V18H9.18C9.35 18.72 9.64 19.39 10.03 20H5Z";var w3="M19,19H5V5H19M19,3H5A2,2 0 0,0 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5A2,2 0 0,0 19,3M13.96,12.29L11.21,15.83L9.25,13.47L6.5,17H17.5L13.96,12.29Z";var O3="M11,9H13V7H11M12,20C7.59,20 4,16.41 4,12C4,7.59 7.59,4 12,4C16.41,4 20,7.59 20,12C20,16.41 16.41,20 12,20M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M11,17H13V11H11V17Z";var $3="M21 18H15V15H13.3C12.2 17.4 9.7 19 7 19C3.1 19 0 15.9 0 12S3.1 5 7 5C9.7 5 12.2 6.6 13.3 9H24V15H21V18M17 16H19V13H22V11H11.9L11.7 10.3C11 8.3 9.1 7 7 7C4.2 7 2 9.2 2 12S4.2 17 7 17C9.1 17 11 15.7 11.7 13.7L11.9 13H17V16M7 15C5.3 15 4 13.7 4 12S5.3 9 7 9 10 10.3 10 12 8.7 15 7 15M7 11C6.4 11 6 11.4 6 12S6.4 13 7 13 8 12.6 8 12 7.6 11 7 11Z";var T3="M12,17C10.89,17 10,16.1 10,15C10,13.89 10.89,13 12,13A2,2 0 0,1 14,15A2,2 0 0,1 12,17M18,20V10H6V20H18M18,8A2,2 0 0,1 20,10V20A2,2 0 0,1 18,22H6C4.89,22 4,21.1 4,20V10C4,8.89 4.89,8 6,8H7V6A5,5 0 0,1 12,1A5,5 0 0,1 17,6V8H18M12,3A3,3 0 0,0 9,6V8H15V6A3,3 0 0,0 12,3Z";var P3="M9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.44,13.73L14.71,14H15.5L20.5,19L19,20.5L14,15.5V14.71L13.73,14.44C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3M9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5Z";var B3="M3,6H21V8H3V6M3,11H21V13H3V11M3,16H21V18H3V16Z";var _3="M17.3,11C17.3,14 14.76,16.1 12,16.1C9.24,16.1 6.7,14 6.7,11H5C5,14.41 7.72,17.23 11,17.72V21H13V17.72C16.28,17.23 19,14.41 19,11M10.8,4.9C10.8,4.24 11.34,3.7 12,3.7C12.66,3.7 13.2,4.24 13.2,4.9L13.19,11.1C13.19,11.76 12.66,12.3 12,12.3C11.34,12.3 10.8,11.76 10.8,11.1M12,14A3,3 0 0,0 15,11V5A3,3 0 0,0 12,2A3,3 0 0,0 9,5V11A3,3 0 0,0 12,14Z";var E3="M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19Z";var R3="M16.5,6V17.5A4,4 0 0,1 12.5,21.5A4,4 0 0,1 8.5,17.5V5A2.5,2.5 0 0,1 11,2.5A2.5,2.5 0 0,1 13.5,5V15.5A1,1 0 0,1 12.5,16.5A1,1 0 0,1 11.5,15.5V6H10V15.5A2.5,2.5 0 0,0 12.5,18A2.5,2.5 0 0,0 15,15.5V5A4,4 0 0,0 11,1A4,4 0 0,0 7,5V17.5A5.5,5.5 0 0,0 12.5,23A5.5,5.5 0 0,0 18,17.5V6H16.5Z";var F3="M14,19H18V5H14M6,19H10V5H6V19Z";var D3="M14.06,9L15,9.94L5.92,19H5V18.08L14.06,9M17.66,3C17.41,3 17.15,3.1 16.96,3.29L15.13,5.12L18.88,8.87L20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18.17,3.09 17.92,3 17.66,3M14.06,6.19L3,17.25V21H6.75L17.81,9.94L14.06,6.19Z";var z3="M8,6.2V4H7V2H17V4H16V12L18,14V16H17.8L14,12.2V4H10V8.2L8,6.2M20,20.7L18.7,22L12.8,16.1V22H11.2V16H6V14L8,12V11.3L2,5.3L3.3,4L20,20.7M8.8,14H10.6L9.7,13.1L8.8,14Z",N3="M16,12V4H17V2H7V4H8V12L6,14V16H11.2V22H12.8V16H18V14L16,12M8.8,14L10,12.8V4H14V12.8L15.2,14H8.8Z";var I3="M8,5.14V19.14L19,12.14L8,5.14Z";var k9="M12,20C7.59,20 4,16.41 4,12C4,7.59 7.59,4 12,4C16.41,4 20,7.59 20,12C20,16.41 16.41,20 12,20M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M10,16.5L16,12L10,7.5V16.5Z";var W3="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z";var j3="M13,2.03V2.05L13,4.05C17.39,4.59 20.5,8.58 19.96,12.97C19.5,16.61 16.64,19.5 13,19.93V21.93C18.5,21.38 22.5,16.5 21.95,11C21.5,6.25 17.73,2.5 13,2.03M11,2.06C9.05,2.25 7.19,3 5.67,4.26L7.1,5.74C8.22,4.84 9.57,4.26 11,4.06V2.06M4.26,5.67C3,7.19 2.25,9.04 2.05,11H4.05C4.24,9.58 4.8,8.23 5.69,7.1L4.26,5.67M2.06,13C2.26,14.96 3.03,16.81 4.27,18.33L5.69,16.9C4.81,15.77 4.24,14.42 4.06,13H2.06M7.1,18.37L5.67,19.74C7.18,21 9.04,21.79 11,22V20C9.58,19.82 8.23,19.25 7.1,18.37M12.5,7V12.25L17,14.92L16.25,16.15L11,13V7H12.5Z";var U3="M17.65,6.35C16.2,4.9 14.21,4 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20C15.73,20 18.84,17.45 19.73,14H17.65C16.83,16.33 14.61,18 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6C13.66,6 15.14,6.69 16.22,7.78L13,11H20V4L17.65,6.35Z";var G3="M17.5 15.5C17.5 16.61 16.61 17.5 15.5 17.5S13.5 16.61 13.5 15.5 14.4 13.5 15.5 13.5 17.5 14.4 17.5 15.5M8.5 13.5C7.4 13.5 6.5 14.4 6.5 15.5S7.4 17.5 8.5 17.5 10.5 16.61 10.5 15.5 9.61 13.5 8.5 13.5M23 15V18C23 18.55 22.55 19 22 19H21V20C21 21.11 20.11 22 19 22H5C3.9 22 3 21.11 3 20V19H2C1.45 19 1 18.55 1 18V15C1 14.45 1.45 14 2 14H3C3 10.13 6.13 7 10 7H11V5.73C10.4 5.39 10 4.74 10 4C10 2.9 10.9 2 12 2S14 2.9 14 4C14 4.74 13.6 5.39 13 5.73V7H14C17.87 7 21 10.13 21 14H22C22.55 14 23 14.45 23 15M21 16H19V14C19 11.24 16.76 9 14 9H10C7.24 9 5 11.24 5 14V16H3V17H5V20H19V17H21V16Z";var q3="M12 3L1 9L5 11.18V17.18L12 21L19 17.18V11.18L21 10.09V17H23V9L12 3M18.82 9L12 12.72L5.18 9L12 5.28L18.82 9M17 16L12 18.72L7 16V12.27L12 15L17 12.27V16Z";var y9="M4 6.03L11.5 9.25L4 8.25L4 6.03M11.5 14.75L4 17.97V15.75L11.5 14.75M2 3L2 10L17 12L2 14L2 21L23 12L2 3Z";var K3="M18 16.08C17.24 16.08 16.56 16.38 16.04 16.85L8.91 12.7C8.96 12.47 9 12.24 9 12S8.96 11.53 8.91 11.3L15.96 7.19C16.5 7.69 17.21 8 18 8C19.66 8 21 6.66 21 5S19.66 2 18 2 15 3.34 15 5C15 5.24 15.04 5.47 15.09 5.7L8.04 9.81C7.5 9.31 6.79 9 6 9C4.34 9 3 10.34 3 12S4.34 15 6 15C6.79 15 7.5 14.69 8.04 14.19L15.16 18.34C15.11 18.55 15.08 18.77 15.08 19C15.08 20.61 16.39 21.91 18 21.91S20.92 20.61 20.92 19C20.92 17.39 19.61 16.08 18 16.08M18 4C18.55 4 19 4.45 19 5S18.55 6 18 6 17 5.55 17 5 17.45 4 18 4M6 13C5.45 13 5 12.55 5 12S5.45 11 6 11 7 11.45 7 12 6.55 13 6 13M18 20C17.45 20 17 19.55 17 19S17.45 18 18 18 19 18.45 19 19 18.55 20 18 20Z";var Q3="M12,1L3,5V11C3,16.55 6.84,21.74 12,23C17.16,21.74 21,16.55 21,11V5L12,1M12,3.18L19,6.3V11.22C19,12.92 18.5,14.65 17.65,16.17C16,14.94 13.26,14.5 12,14.5C10.74,14.5 8,14.94 6.35,16.17C5.5,14.65 5,12.92 5,11.22V6.3L12,3.18M12,6A3.5,3.5 0 0,0 8.5,9.5A3.5,3.5 0 0,0 12,13A3.5,3.5 0 0,0 15.5,9.5A3.5,3.5 0 0,0 12,6M12,8A1.5,1.5 0 0,1 13.5,9.5A1.5,1.5 0 0,1 12,11A1.5,1.5 0 0,1 10.5,9.5A1.5,1.5 0 0,1 12,8M12,16.5C13.57,16.5 15.64,17.11 16.53,17.84C15.29,19.38 13.7,20.55 12,21C10.3,20.55 8.71,19.38 7.47,17.84C8.37,17.11 10.43,16.5 12,16.5Z";var X3="M21,11C21,16.55 17.16,21.74 12,23C6.84,21.74 3,16.55 3,11V5L12,1L21,5V11M12,21C15.75,20 19,15.54 19,11.22V6.3L12,3.18L5,6.3V11.22C5,15.54 8.25,20 12,21M11,7H13V13H11V7M11,15H13V17H11V15Z";var Y3="M18,18H6V6H18V18Z";var J3="M18 22H6V16L10 12L6 8V2H18V8L14 12L18 16M8 7.5L12 11.5L16 7.5V4H8M12 12.5L8 16.5V20H16V16.5M14 18H10V17.2L12 15.2L14 17.2Z";var C0="M20 8H17V6C17 4.9 16.1 4 15 4H9C7.9 4 7 4.9 7 6V8H4C2.9 8 2 8.9 2 10V20H22V10C22 8.9 21.1 8 20 8M9 6H15V8H9V6M20 18H4V15H6V16H8V15H16V16H18V15H20V18M18 13V12H16V13H8V12H6V13H4V10H20V13H18Z",H0="M21.71 20.29L20.29 21.71A1 1 0 0 1 18.88 21.71L7 9.85A3.81 3.81 0 0 1 6 10A4 4 0 0 1 2.22 4.7L4.76 7.24L5.29 6.71L6.71 5.29L7.24 4.76L4.7 2.22A4 4 0 0 1 10 6A3.81 3.81 0 0 1 9.85 7L21.71 18.88A1 1 0 0 1 21.71 20.29M2.29 18.88A1 1 0 0 0 2.29 20.29L3.71 21.71A1 1 0 0 0 5.12 21.71L10.59 16.25L7.76 13.42M20 2L16 4V6L13.83 8.17L15.83 10.17L18 8H20L22 4Z";var V0="M9,3V4H4V6H5V19A2,2 0 0,0 7,21H17A2,2 0 0,0 19,19V6H20V4H15V3H9M7,6H17V19H7V6M9,8V17H11V8H9M13,8V17H15V8H13Z";var w9="M8 13C6.14 13 4.59 14.28 4.14 16H2V18H4.14C4.59 19.72 6.14 21 8 21S11.41 19.72 11.86 18H22V16H11.86C11.41 14.28 9.86 13 8 13M8 19C6.9 19 6 18.1 6 17C6 15.9 6.9 15 8 15S10 15.9 10 17C10 18.1 9.1 19 8 19M19.86 6C19.41 4.28 17.86 3 16 3S12.59 4.28 12.14 6H2V8H12.14C12.59 9.72 14.14 11 16 11S19.41 9.72 19.86 8H22V6H19.86M16 9C14.9 9 14 8.1 14 7C14 5.9 14.9 5 16 5S18 5.9 18 7C18 8.1 17.1 9 16 9Z";var e0="M9,16V10H5L12,3L19,10H15V16H9M5,20V18H19V20H5Z";var L0="M16.36,14C16.44,13.34 16.5,12.68 16.5,12C16.5,11.32 16.44,10.66 16.36,10H19.74C19.9,10.64 20,11.31 20,12C20,12.69 19.9,13.36 19.74,14M14.59,19.56C15.19,18.45 15.65,17.25 15.97,16H18.92C17.96,17.65 16.43,18.93 14.59,19.56M14.34,14H9.66C9.56,13.34 9.5,12.68 9.5,12C9.5,11.32 9.56,10.65 9.66,10H14.34C14.43,10.65 14.5,11.32 14.5,12C14.5,12.68 14.43,13.34 14.34,14M12,19.96C11.17,18.76 10.5,17.43 10.09,16H13.91C13.5,17.43 12.83,18.76 12,19.96M8,8H5.08C6.03,6.34 7.57,5.06 9.4,4.44C8.8,5.55 8.35,6.75 8,8M5.08,16H8C8.35,17.25 8.8,18.45 9.4,19.56C7.57,18.93 6.03,17.65 5.08,16M4.26,14C4.1,13.36 4,12.69 4,12C4,11.31 4.1,10.64 4.26,10H7.64C7.56,10.66 7.5,11.32 7.5,12C7.5,12.68 7.56,13.34 7.64,14M12,4.03C12.83,5.23 13.5,6.57 13.91,8H10.09C10.5,6.57 11.17,5.23 12,4.03M18.92,8H15.97C15.65,6.75 15.19,5.55 14.59,4.44C16.43,5.07 17.96,6.34 18.92,8M12,2C6.47,2 2,6.5 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z";var HC={"Neuer Chat":"New chat","Neues Cowork":"New cowork",Chats:"Chats",Projekte:"Projects",Geplant:"Scheduled",Skills:"Skills",Zug\u00E4nge:"Credentials",Einstellungen:"Settings",Admin:"Admin",Zuletzt:"Recents",Angeheftet:"Pinned","Guten Morgen":"Good morning","Guten Tag":"Good afternoon","Guten Abend":"Good evening","Gute Nacht":"Good night","Geplante Aufgaben":"Scheduled tasks","Wie kann ich helfen?":"How can I help?","Was soll ich erledigen?":"What should I get done?","Nachricht schreiben \u2026":"Write a message \u2026","Aufgabe beschreiben \u2026":"Describe the task \u2026","Antworten \u2026":"Reply \u2026",Senden:"Send",Stopp:"Stop",Anh\u00E4ngen:"Attach",Spracheingabe:"Voice input",Werkzeuge:"Tools",Modell:"Model",Kontext:"Context",Heute:"Today",Kontingent:"Quota",Schl\u00FCssel:"Key","Denkt nach \u2026":"Thinking \u2026","Schreibt \u2026":"Writing \u2026","Wartet auf Freigabe":"Waiting for approval",Gedanken:"Thoughts",Schritte:"Steps",Fortschritt:"Progress",Dateien:"Files","Einmal erlauben":"Allow once","Immer erlauben":"Always allow",Ablehnen:"Deny",\u00DCbernehmen:"Apply","F\xFCr diesen Chat einschalten":"Turn on for this chat",Kopieren:"Copy",Kopiert:"Copied","Erneut versuchen":"Retry",L\u00F6schen:"Delete",Umbenennen:"Rename",Anheften:"Pin",L\u00F6sen:"Unpin",Speichern:"Save",Abbrechen:"Cancel",Schlie\u00DFen:"Close",Gespeichert:"Saved",Name:"Name",Beschreibung:"Description",Anweisungen:"Instructions","Neues Projekt":"New project","Neue Aufgabe":"New task","Neuer Skill":"New skill","Neuer Zugang":"New credential","Jetzt ausf\xFChren":"Run now",Aktiv:"Active",Pausiert:"Paused","N\xE4chster Lauf":"Next run","Letzter Lauf":"Last run",L\u00E4ufe:"Runs",Auftrag:"Prompt",Zeitplan:"Schedule",Benachrichtigen:"Notify",Typ:"Type",Notiz:"Note",Anzeigen:"Show",Verbergen:"Hide","Suchen \u2026":"Search \u2026",Alle:"All",Aufgabenl\u00E4ufe:"Task runs","Keine Chats":"No chats","Kein Zugriff":"No access","Laden \u2026":"Loading \u2026",Verbrauch:"Usage",Importieren:"Import","Pers\xF6nliche Hinweise":"Personal notes","H\xF6rt genau hin":"Listening closely","Sortiert Silben":"Sorting syllables","F\xFCgt W\xF6rter zusammen":"Piecing words together","Entziffert Genuschel":"Deciphering mumbles","Setzt Satzzeichen":"Adding punctuation","Bringt es zu Papier":"Putting it on paper","Chats ausw\xE4hlen":"Select chats","{n} ausgew\xE4hlt":"{n} selected",Keine:"None","Diesen Chat l\xF6schen?":"Delete this chat?","{n} Chats l\xF6schen?":"Delete {n} chats?","Chat gel\xF6scht":"Chat deleted","{n} Chats gel\xF6scht":"{n} chats deleted","Alle pr\xFCfen":"Check all","Pr\xFCfe \u2026":"Checking \u2026","Jetzt pr\xFCfen":"Check now","Funktionieren die Zugangsdaten?":"Do the credentials work?","Zugang funktioniert":"Credential works",Zur\u00FCcknehmen:"Take back","Kommt als N\xE4chstes dran":"Up next","Wartet \xB7 {n}.":"Waiting \xB7 {n}.","Jetzt senden":"Send now","Senden \u2013 kommt nach der laufenden Antwort dran":"Send \u2013 goes out after the current answer","Geplante Aufgabe":"Scheduled task",Fertig:"Done",Entfernen:"Remove","Chat \xF6ffnen":"Open chat","Alle {n} entfernen":"Remove all {n}","Nur diese entfernen":"Remove just this one","Benachrichtigungen dieses Chats ausschalten":"Turn off notifications for this chat","Benachrichtigungen f\xFCr diesen Chat aus":"Notifications for this chat are off","In Projekt verschieben":"Move to project","Ohne Projekt":"No project","Chat verschieben":"Move chat","Chat hierher ziehen":"Drag a chat here","Nach \u201E{p}\u201C verschoben":"Moved to \u201C{p}\u201D","Aus dem Projekt entfernt":"Removed from the project","Noch keine Projekte angelegt.":"No projects yet."},O9="de";function $9(r){O9=(r||"de").slice(0,2)}function p(r,V){let C=O9==="de"?r:HC[r]??r;if(V)for(let[H,e]of Object.entries(V))C=C.replace(`{${H}}`,String(e));return C}var F=r=>V=>{customElements.get(r)||customElements.define(r,V)},T9={plus:W3,chat:e3,cowork:f3,robot:G3,project:Z3,task:C3,skill:q3,key:$3,settings:n3,admin:Q3,menu:B3,sidebar:p3,send:l5,stop:Y3,attach:R3,mic:_3,close:a3,check:L3,copy:s3,retry:U3,trash:V0,pin:N3,pinOff:z3,edit:D3,down:t3,right:i3,left:r3,dots:c3,eye:x3,eyeOff:u3,brain:b3,tools:C0,file:h3,download:v3,upload:e0,play:I3,pause:F3,clock:M3,alert:Q5,info:O3,search:P3,web:L0,home:y3,image:w3,lock:T3,gauge:g3,bell:J5,bellOff:Y5,list:S3,user:K5,import:A3,panel:m3,sparkle:l3,hourglass:J3,cloud:o3,wait:j3,external:E3,calendarEdit:H3,calendarPlus:V3,contact:q5,up:l5,arrowDown:X5,euro:d3,shield:X3,share:K3};function VC(r){if(T9[r])return T9[r];if(r?.startsWith("mdi:")){let V="mdi"+r.slice(4).split("-").map(C=>C[0]?.toUpperCase()+C.slice(1)).join("");return v7[V]||H0}return k3}var d=(r,V=20)=>h4`<svg class="i" viewBox="0 0 24 24" width=${V} height=${V} aria-hidden="true"><path d=${VC(r)} fill="currentColor"/></svg>`,I=r=>(r=Number(r||0),r>=1e6?(r/1e6).toFixed(r>=1e7?0:1).replace(".",",")+" Mio.":r>=1e4?Math.round(r/1e3)+"k":r>=1e3?(r/1e3).toFixed(1).replace(".",",")+"k":String(Math.round(r))),A5=r=>{let V=r==null||r===""?0:Number(r);return!Number.isFinite(V)||V<=0?"aus":`${V} Tag${V===1?"":"e"}`},D=r=>{if(!r)return"\u2013";let V=typeof r=="number"?new Date(r*1e3):new Date(r),C=new Date,H=V.toDateString()===C.toDateString(),e=V.toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"});if(H)return e;let L=new Date(C);return L.setDate(C.getDate()-1),V.toDateString()===L.toDateString()?`gestern ${e}`:V.toLocaleDateString("de-DE",{day:"2-digit",month:"2-digit",year:V.getFullYear()!==C.getFullYear()?"2-digit":void 0})+" "+e},x1=r=>(r=Math.max(0,Math.round(r)),r<60?`${r} s`:r<3600?`${Math.floor(r/60)} min ${r%60?r%60+" s":""}`.trim():`${Math.floor(r/3600)} h ${Math.round(r%3600/60)} min`);R.setOptions({gfm:!0,breaks:!0});c7.addHook("afterSanitizeAttributes",r=>{r.tagName==="A"&&(r.setAttribute("target","_blank"),r.setAttribute("rel","noopener noreferrer"))});var t0=new Map;function T1(r,V={}){let C=(V.breaks===!1?"d":"c")+"\0"+(r||""),H=t0.get(C);if(H!==void 0)return Y0(H);let e=R.parse(r||"",{async:!1,gfm:!0,breaks:V.breaks??!0});e=e.replace(/<table>/g,'<div class="md-tw"><table>').replace(/<\/table>/g,"</table></div>");let L=c7.sanitize(e,{FORBID_TAGS:["style","form","input"],FORBID_ATTR:["style"]});return t0.size>300&&t0.clear(),t0.set(C,L),Y0(L)}function A2(r){navigator.clipboard?.writeText(r).then(()=>A.notify(p("Kopiert")),()=>{let V=document.createElement("textarea");V.value=r,document.body.appendChild(V),V.select(),document.execCommand("copy"),V.remove(),A.notify(p("Kopiert"))})}var p5=B`
  :host {
    --lm-bg: #f4f4f4; --lm-side: #e9e9e9; --lm-panel: #ffffff; --lm-raise: #ffffff; --lm-text: #222222; --lm-muted: #646464;
    --lm-faint: #9b9b9b; --lm-line: #dcdcdc; --lm-hover: rgba(0, 0, 0, 0.055); --lm-accent: #2d6a4f; --lm-accent-2: #3b8262;
    --lm-accent-soft: rgba(45, 106, 79, 0.12); --lm-on-accent: #ffffff; --lm-ok: #2f8a57; --lm-warn: #b98112; --lm-err: #c0433a;
    --lm-user: #e6e6e6; --lm-shadow: 0 1px 2px rgba(0,0,0,.05), 0 4px 18px rgba(0, 0, 0, .07); --lm-r: 14px;
    --lm-head: "Inter", "Segoe UI Variable Display", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    --lm-sans: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    --lm-mono: ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace;
    color: var(--lm-text); font-family: var(--lm-sans); -webkit-font-smoothing: antialiased;
  }
  :host([dark]) {
    --lm-bg: #1c1c1c; --lm-side: #151515; --lm-panel: #252525; --lm-raise: #2b2b2b; --lm-text: #e8e8e8; --lm-muted: #a2a2a2;
    --lm-faint: #6f6f6f; --lm-line: #343434; --lm-hover: rgba(255, 255, 255, 0.06); --lm-accent: #5fae86; --lm-accent-2: #78c29c;
    --lm-accent-soft: rgba(95, 174, 134, 0.16); --lm-on-accent: #0d1a14; --lm-user: #2f2f2f;
    --lm-shadow: 0 1px 2px rgba(0,0,0,.35), 0 6px 22px rgba(0,0,0,.28);
  }

`,j=B`
  :host { color: var(--lm-text); font-family: var(--lm-sans); -webkit-font-smoothing: antialiased; }
  * { box-sizing: border-box; }
  .i { flex: none; display: inline-block; vertical-align: middle; }
  button { font: inherit; color: inherit; }
  .btn { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--lm-line); background: var(--lm-raise);
    border-radius: 10px; padding: 7px 12px; min-height: 36px; cursor: pointer; transition: background .15s, border-color .15s, transform .1s; }
  .btn:hover { background: var(--lm-hover); }
  .btn:active { transform: scale(.98); }
  .btn.primary { background: var(--lm-accent); border-color: var(--lm-accent); color: var(--lm-on-accent); }
  .btn.primary:hover { background: var(--lm-accent-2); }
  .btn.ghost { border-color: transparent; background: transparent; }
  .btn.danger { color: var(--lm-err); }
  .btn[disabled] { opacity: .45; pointer-events: none; }
  .iconbtn { display: inline-grid; place-items: center; width: 36px; height: 36px; border-radius: 10px; border: 0; background: transparent;
    color: var(--lm-muted); cursor: pointer; transition: background .15s, color .15s; }
  .iconbtn:hover { background: var(--lm-hover); color: var(--lm-text); }
  .iconbtn.on { color: var(--lm-accent); }
  input, textarea, select { font: inherit; color: var(--lm-text); background: var(--lm-panel); border: 1px solid var(--lm-line);
    border-radius: 10px; padding: 9px 11px; width: 100%; outline: none; transition: border-color .15s, box-shadow .15s; }
  input:focus, textarea:focus, select:focus { border-color: var(--lm-accent); box-shadow: 0 0 0 3px var(--lm-accent-soft); }
  textarea { resize: vertical; line-height: 1.5; }
  textarea.code { font-family: var(--lm-mono); font-size: 13px; }
  label.f { display: grid; gap: 6px; font-size: 13px; color: var(--lm-muted); }
  label.f > span { font-weight: 550; color: var(--lm-text); }
  .hint { font-size: 12.5px; color: var(--lm-muted); line-height: 1.45; overflow-wrap: anywhere; }
  code { overflow-wrap: anywhere; }
  .shimmer { background: linear-gradient(90deg, var(--lm-muted) 0%, var(--lm-text) 45%, var(--lm-muted) 90%); background-size: 200% 100%;
    -webkit-background-clip: text; background-clip: text; color: transparent; animation: shimmer 2.2s linear infinite; }
  @keyframes shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
  .card { background: var(--lm-panel); border: 1px solid var(--lm-line); border-radius: var(--lm-r); padding: 16px; }
  .chip { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; padding: 3px 9px; border-radius: 999px;
    background: var(--lm-hover); color: var(--lm-muted); white-space: nowrap; }
  .chip.accent { background: var(--lm-accent-soft); color: var(--lm-accent); }
  .chip.ok { background: rgba(63,143,91,.13); color: var(--lm-ok); }
  .chip.err { background: rgba(194,69,59,.12); color: var(--lm-err); }
  .chip.warn { background: rgba(197,138,22,.14); color: var(--lm-warn); }
  .row { display: flex; align-items: center; gap: 8px; }
  .grow { flex: 1; min-width: 0; }
  .muted { color: var(--lm-muted); }
  .ellipsis { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .page { max-width: 980px; margin: 0 auto; padding: 28px 24px 80px; min-width: 0; overflow-x: hidden; }
  .page .row:has(> h1) { margin-bottom: 18px; flex-wrap: wrap; row-gap: 10px; }
  .page .row > h1 { margin: 4px 0; }
  a { color: var(--lm-accent); }
  .page h1 { font-family: var(--lm-head); font-weight: 650; font-size: 28px; margin: 4px 0 18px; letter-spacing: -.02em; overflow-wrap: anywhere; }
  .page h2 { font-size: 15px; margin: 26px 0 10px; font-weight: 600; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(250px, 100%), 1fr)); gap: 12px; }
  .list { display: grid; gap: 8px; grid-template-columns: minmax(0, 1fr); }
  .list > *, .grid > * { min-width: 0; }
  .clamp2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere; }
  .item { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border: 1px solid var(--lm-line); border-radius: 12px;
    background: var(--lm-panel); cursor: pointer; transition: border-color .15s, box-shadow .15s, transform .15s; min-width: 0; }
  .item > * { min-width: 0; }
  /* Chips einer Zeile: duerfen umbrechen und draengen den Namen nicht weg */
  .tags { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; justify-content: flex-end; min-width: 0; }
  .tags .chip { flex: none; }
  /* Zugangsliste: der Name behaelt mindestens 8em, die Chips rutschen bei Platzmangel darunter */
  .item.cred { flex-wrap: wrap; row-gap: 8px; }
  .item.cred > .grow { flex: 1 1 8em; }
  .item:hover { border-color: color-mix(in srgb, var(--lm-accent) 35%, var(--lm-line)); box-shadow: var(--lm-shadow); }
  .md { line-height: 1.62; font-size: 15.5px; overflow-wrap: anywhere; min-width: 0; }
  .md p { margin: 0 0 .75em; } .md p:last-child { margin-bottom: 0; }
  .md h1, .md h2, .md h3 { font-family: var(--lm-head); font-weight: 600; line-height: 1.3; margin: 1.1em 0 .5em; }
  .md h1 { font-size: 1.45em; } .md h2 { font-size: 1.25em; } .md h3 { font-size: 1.08em; }
  .md code { font-family: var(--lm-mono); font-size: .86em; background: var(--lm-hover); padding: .1em .35em; border-radius: 5px; }
  .md pre { background: var(--lm-side); border: 1px solid var(--lm-line); padding: 12px 14px; border-radius: 10px; overflow-x: auto; max-width: 100%; }
  .md pre code { background: none; padding: 0; font-size: 13px; }
  .md-tw { max-width: 100%; overflow-x: auto; margin: .6em 0; }
  .md table { border-collapse: collapse; width: max-content; min-width: 100%; margin: 0; font-size: 14px; }
  .md th, .md td { border: 1px solid var(--lm-line); padding: 6px 10px; text-align: left; overflow-wrap: normal; word-break: normal; }
  .md td { min-width: 4.5em; }
  .md th { background: var(--lm-side); }
  .md blockquote { margin: .6em 0; padding-left: 12px; border-left: 3px solid var(--lm-line); color: var(--lm-muted); }
  .md a { color: var(--lm-accent); }
  .md ul, .md ol { padding-left: 1.4em; margin: .3em 0 .8em; }
  .md li { margin: .2em 0; }
  .md img { max-width: 100%; border-radius: 8px; }
  .fade-in { animation: fadeIn .28s ease both; }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
  @media (max-width: 640px) { .page { padding: 16px 14px 90px; } .page h1 { font-size: 25px; }
    /* Schmaler Bildschirm: Name und Chips untereinander statt Name auf Briefmarkengroesse */
    .item.cred > .tags { flex: 1 1 100%; justify-content: flex-start; } }
`,e1=class extends C1{constructor(){super(...arguments);this.__onStore=()=>this.requestUpdate()}connectedCallback(){super.connectedCallback(),A.addEventListener("change",this.__onStore)}disconnectedCallback(){super.disconnectedCallback(),A.removeEventListener("change",this.__onStore)}},d2=class extends C1{constructor(){super(...arguments);this.active=!0;this.size=22}render(){return t`<svg class=${this.active?"on":""} width=${this.size} height=${this.size} viewBox="0 0 24 24" fill="none"
        stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <g class="bot">
        <line x1="12" y1="3.6" x2="12" y2="6.4"/>
        <circle class="lamp" cx="12" cy="2.6" r="1.25" fill="currentColor" stroke="none"/>
        <rect x="4.6" y="6.6" width="14.8" height="11.2" rx="3.6"/>
        <line x1="2.6" y1="11" x2="2.6" y2="13.6"/><line x1="21.4" y1="11" x2="21.4" y2="13.6"/>
        <circle class="eye" cx="9.3" cy="11.6" r="1.25" fill="currentColor" stroke="none"/>
        <circle class="eye r" cx="14.7" cy="11.6" r="1.25" fill="currentColor" stroke="none"/>
        <line class="mouth" x1="10.2" y1="14.9" x2="13.8" y2="14.9"/>
        <path d="M8.6 17.8 L8 20.6 M15.4 17.8 L16 20.6" opacity=".55"/>
      </g></svg>`}};d2.styles=B`
    :host { display: inline-grid; place-items: center; color: var(--lm-accent, #2d6a4f); }
    svg { overflow: visible; }
    .on .bot { animation: bob 1.8s ease-in-out infinite; transform-origin: 12px 20px; }
    .on .lamp { animation: glow 1.2s ease-in-out infinite; }
    .on .eye { animation: blink 3.6s infinite; transform-box: fill-box; transform-origin: center; }
    .on .eye.r { animation-delay: .08s; }
    .on .mouth { animation: talk .9s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
    @keyframes bob { 0%, 100% { transform: translateY(0) rotate(0); } 30% { transform: translateY(-.8px) rotate(-3deg); } 70% { transform: translateY(-.4px) rotate(3deg); } }
    @keyframes glow { 0%, 100% { opacity: .35; } 50% { opacity: 1; } }
    @keyframes blink { 0%, 92%, 100% { transform: scaleY(1); } 95% { transform: scaleY(.1); } }
    @keyframes talk { 0%, 100% { transform: scaleX(1); } 50% { transform: scaleX(.55); } }
  `,h([T({type:Boolean})],d2.prototype,"active",2),h([T({type:Number})],d2.prototype,"size",2),d2=h([F("lm-spark")],d2);var X1=class extends C1{constructor(){super(...arguments);this.value=0;this.size=20;this.label=""}render(){let C=Math.max(0,Math.min(1,this.value||0)),H=8,e=2*Math.PI*H,L=C>=.9?"var(--lm-err, #c0433a)":C>=.7?"var(--lm-warn, #b98112)":"var(--lm-accent, #2d6a4f)";return t`<svg width=${this.size} height=${this.size} viewBox="0 0 20 20" role="img" aria-label=${this.label}>
      <circle cx="10" cy="10" r=${H} fill="none" stroke="var(--lm-line, #ddd)" stroke-width="2.6"/>
      <circle cx="10" cy="10" r=${H} fill="none" stroke=${L} stroke-width="2.6" stroke-linecap="round"
        stroke-dasharray=${e} stroke-dashoffset=${e*(1-C)} transform="rotate(-90 10 10)"/></svg>`}};X1.styles=B`
    :host { display: inline-grid; place-items: center; }
    circle { transition: stroke-dashoffset .6s ease, stroke .3s; }
  `,h([T({type:Number})],X1.prototype,"value",2),h([T({type:Number})],X1.prototype,"size",2),h([T()],X1.prototype,"label",2),X1=h([F("lm-ring")],X1);var Y1=class extends C1{constructor(){super(...arguments);this.open=!1;this.align="left";this.direction="up";this._doc=C=>{C.composedPath().includes(this)||(this.open=!1)}}connectedCallback(){super.connectedCallback(),document.addEventListener("pointerdown",this._doc)}disconnectedCallback(){super.disconnectedCallback(),document.removeEventListener("pointerdown",this._doc)}updated(){let C=this.renderRoot.querySelector(".pop");if(!C)return;C.style.translate="",C.style.maxHeight="";let H=C.getBoundingClientRect(),e=8,L=0;H.right>innerWidth-e&&(L=innerWidth-e-H.right),H.left+L<e&&(L=e-H.left),L&&(C.style.translate=`${Math.round(L)}px 0`),H.top<e?C.style.maxHeight=`${Math.max(160,H.height-(e-H.top))}px`:H.bottom>innerHeight-e&&(C.style.maxHeight=`${Math.max(160,H.height-(H.bottom-innerHeight+e))}px`)}render(){return t`<span @click=${()=>this.open=!this.open}><slot name="trigger"></slot></span>
      ${this.open?t`<div class="pop ${this.direction} ${this.align}" @click=${C=>{C.target.closest("[data-close]")&&(this.open=!1)}}><slot></slot></div>`:s}`}};Y1.styles=[j,B`
    :host { position: relative; display: inline-block; }
    .pop { position: absolute; z-index: 30; min-width: min(240px, calc(100vw - 16px)); max-width: min(360px, calc(100vw - 16px)); max-height: min(60vh, 520px); overflow-y: auto;
      background: var(--lm-raise); border: 1px solid var(--lm-line); border-radius: 14px; box-shadow: 0 10px 40px rgba(0,0,0,.16);
      padding: 6px; animation: pop .16s ease both; }
    .up { bottom: calc(100% + 8px); } .down { top: calc(100% + 6px); }
    .left { left: 0; } .right { right: 0; }
    @keyframes pop { from { opacity: 0; transform: translateY(4px) scale(.98); } }
  `],h([T({type:Boolean,reflect:!0})],Y1.prototype,"open",2),h([T()],Y1.prototype,"align",2),h([T()],Y1.prototype,"direction",2),Y1=h([F("lm-menu")],Y1);var $2=B`
  .mi { display: flex; align-items: center; gap: 10px; width: 100%; padding: 9px 10px; border: 0; background: none; border-radius: 9px;
    cursor: pointer; text-align: left; color: var(--lm-text); font-size: 14px; }
  .mi:hover { background: var(--lm-hover); }
  .mi .sub { font-size: 12px; color: var(--lm-muted); }
  .mi.sel { background: var(--lm-accent-soft); }
  .mh { font-size: 11.5px; text-transform: uppercase; letter-spacing: .05em; color: var(--lm-faint); padding: 8px 10px 4px; }
  .msep { height: 1px; background: var(--lm-line); margin: 6px 4px; }
`,d5=class{constructor(){this.chunks=[];this.rate=48e3;this.level=0}static supported(){return!!(typeof navigator.mediaDevices?.getUserMedia=="function"&&(window.AudioContext||window.webkitAudioContext))}async start(){this.stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:!0,noiseSuppression:!0,channelCount:1}});let V=window.AudioContext||window.webkitAudioContext;this.ctx=new V,this.rate=this.ctx.sampleRate,this.src=this.ctx.createMediaStreamSource(this.stream),this.proc=this.ctx.createScriptProcessor(4096,1,1),this.proc.onaudioprocess=C=>{let H=C.inputBuffer.getChannelData(0);this.chunks.push(new Float32Array(H));let e=0;for(let L=0;L<H.length;L+=16)e+=H[L]*H[L];this.level=Math.min(1,Math.sqrt(e/(H.length/16))*4)},this.src.connect(this.proc),this.proc.connect(this.ctx.destination)}async stop(){this.proc?.disconnect(),this.src?.disconnect(),this.stream?.getTracks().forEach(a=>a.stop()),await this.ctx?.close();let V=this.chunks.reduce((a,m)=>a+m.length,0),C=new Float32Array(V),H=0;for(let a of this.chunks)C.set(a,H),H+=a.length;this.chunks=[];let e=this.rate/16e3,L=Math.floor(C.length/e),i=new Int16Array(L);for(let a=0;a<L;a++){let m=Math.floor(a*e),c=Math.min(C.length,Math.floor((a+1)*e)),u=0;for(let x=m;x<c;x++)u+=C[x];let b=Math.max(-1,Math.min(1,u/Math.max(1,c-m)));i[a]=b<0?b*32768:b*32767}let M=new ArrayBuffer(44+i.length*2),o=new DataView(M),l=(a,m)=>{for(let c=0;c<m.length;c++)o.setUint8(a+c,m.charCodeAt(c))};return l(0,"RIFF"),o.setUint32(4,36+i.length*2,!0),l(8,"WAVE"),l(12,"fmt "),o.setUint32(16,16,!0),o.setUint16(20,1,!0),o.setUint16(22,1,!0),o.setUint32(24,16e3,!0),o.setUint32(28,32e3,!0),o.setUint16(32,2,!0),o.setUint16(34,16,!0),l(36,"data"),o.setUint32(40,i.length*2,!0),new Int16Array(M,44).set(i),new Blob([M],{type:"audio/wav"})}cancel(){this.proc?.disconnect(),this.src?.disconnect(),this.stream?.getTracks().forEach(V=>V.stop()),this.ctx?.close(),this.chunks=[]}};function v1(r,V="L\xF6schen"){return new Promise(C=>{let H=(document.querySelector("home-assistant")?.shadowRoot,document.body),e=document.createElement("lm-confirm");e.text=r,e.ok=V,e.dark=!!A.data?.__dark,e.addEventListener("done",L=>{C(L.detail),e.remove()}),H.appendChild(e)})}var J1=class extends C1{constructor(){super(...arguments);this.text="";this.ok="OK";this.dark=!1}done(C){this.dispatchEvent(new CustomEvent("done",{detail:C}))}render(){return t`<div class="back" @click=${C=>C.target===C.currentTarget&&this.done(!1)}>
      <div class="box"><p>${this.text}</p><div class="row" style="justify-content:flex-end">
        <button class="btn" @click=${()=>this.done(!1)}>${p("Abbrechen")}</button>
        <button class="btn primary" @click=${()=>this.done(!0)}>${p(this.ok)}</button></div></div></div>`}};J1.styles=[p5,j,B`
    .back { position: fixed; inset: 0; background: rgba(0,0,0,.35); display: grid; place-items: center; z-index: 9999; animation: fadeIn .15s; padding: 16px;
      padding-top: calc(16px + var(--safe-area-inset-top, 0px)); padding-bottom: calc(16px + var(--safe-area-inset-bottom, 0px)); }
    .box { background: var(--lm-panel); color: var(--lm-text); border-radius: 16px; padding: 20px; width: min(420px, 100%); box-shadow: 0 20px 60px rgba(0,0,0,.3); }
    .box p { margin: 0 0 18px; line-height: 1.5; }
  `],h([T()],J1.prototype,"text",2),h([T()],J1.prototype,"ok",2),h([T({type:Boolean,reflect:!0})],J1.prototype,"dark",2),J1=h([F("lm-confirm")],J1);var eC=12,LC=25,P9=()=>A.data?.models||[],T2=r=>P9().find(V=>V.id===r),b1=r=>T2(r)?.name||r||"";function P2(r){return!r||(r.demand===null||r.demand===void 0)&&!r.slow?null:r.busy?{level:2,text:r.slow?"antwortet gerade sehr langsam":"stark ausgelastet",color:"var(--lm-err)"}:r.demand>=2?{level:1,text:"etwas ausgelastet",color:"var(--lm-warn)"}:{level:0,text:"frei",color:"var(--lm-ok)"}}var m5=(r,V=8)=>{let C=P2(r);return C?t`<span title=${`Auslastung: ${C.text}`} style="display:inline-block;flex:none;width:${V}px;height:${V}px;border-radius:50%;background:${C.color}"></span>`:s};function B9(r,V,C=!1){let e=T2(r)?.quality?.[V]||0,L=P9().filter(l=>l.id!==r&&l.status!=="unavailable"&&!l.busy&&(l.quality?.[C?"vision":V]||0)>0&&(!C||(l.input||[]).includes("image")));if(!L.length)return null;let i=l=>l.demand>=3?3:l.demand>=2?1:0,M=L.reduce((l,a)=>a.quality[V]-i(a)>l.quality[V]-i(l)?a:l),o=M.quality[V];return e&&o<e-LC?null:{...M,similar:!e||o>=e-eC,better:o>e}}function c5(r,V="Standard"){let C=A.data?.defaults||{};return C[`${r}_auto`]?`${V} \u2013 automatisch (derzeit ${b1(C[r])})`:`${V} (${b1(C[r])})`}var h1=r=>/^(foundry|anthropic):/.test(r||""),r1=()=>A.data?.external||{},G=(r,V=2)=>Number(r||0).toLocaleString("de-DE",{minimumFractionDigits:V,maximumFractionDigits:Math.max(V,2)})+" \u20AC",v5=r=>r?`${G(r.in)} / ${G(r.out)} je Mio. Tokens (lesen/schreiben)`:"Preis unbekannt",r0=r=>r?(2e4*r.in+1e3*r.out)/1e6:0,tC=r=>(A.data?.models||[]).find(C=>C.id===r)?.operator||"einem externen Anbieter";function u7(r){let V=r1();return t`<div class="extx">
    <p><b>Was ist anders?</b> Diese Modelle laufen nicht beim Hauptanbieter dieser Installation (z. B. dem Rechenzentrum der GWDG),
      sondern bei <b>${r||"einem externen Anbieter (Microsoft Azure oder Anthropic)"}</b>. Sie sind sehr leistungsfähig, kosten aber
      bei jeder Anfrage Geld.</p>
    <p><b>Was wird dorthin geschickt?</b> Deine Nachrichten, der bisherige Verlauf des Chats, Anhänge, Projektanweisungen, deine persönlichen
      Hinweise, Skill-Texte und die Ergebnisse der Werkzeuge – zum Beispiel Werte aus Home Assistant oder Dateien aus freigegebenen Zugängen.</p>
    <p><b>Was nie dorthin geht:</b> Passwörter und Schlüssel aus deinen Zugängen. Zugänge, die du nicht ausdrücklich für externe Modelle
      freigibst, bleiben ganz außen vor – auch ihre Ergebnisse werden aus dem Verlauf entfernt. Projekte lassen sich ganz sperren.</p>
    <p class="warn">${d("shield",18)}<span><b>Bitte gib dort keine sensiblen Informationen preis:</b> keine Gesundheitsdaten, Passwörter,
      Kontodaten oder persönlichen Daten anderer Menschen.</span></p>
    <p><b>Speicherung:</b> Der Anbieter darf Anfragen eine begrenzte Zeit aufbewahren (bei Claude bis zu 30 Tage, z. B. zur Erkennung von
      Missbrauch); zum Trainieren von KI-Modellen werden sie nicht verwendet.</p>
    <p><b>Kosten:</b> Der Admin hat dir ein Monatslimit von ${G(V.limit_eur||0)} gegeben; diesen Monat sind ${G(V.month_eur||0)}
      verbraucht. LLMitMir wählt externe Modelle nie von selbst – nur wenn du es ausdrücklich möchtest oder eine Aufgabe es im Notfall darf.</p>
  </div>`}var u5=B`
  .extx p { margin: 0 0 10px; line-height: 1.5; font-size: 14px; }
  .extx .warn { display: flex; gap: 8px; align-items: flex-start; padding: 10px 12px; border-radius: 10px;
    background: color-mix(in srgb, var(--lm-warn) 12%, var(--lm-panel)); border: 1px solid color-mix(in srgb, var(--lm-warn) 35%, var(--lm-line)); }
  .extx .warn svg { color: var(--lm-warn); flex: none; margin-top: 1px; }
  .chip.ext { background: color-mix(in srgb, var(--lm-warn) 14%, transparent); color: var(--lm-text); }`;async function B2(r){if(r1().consent)return!0;if(!await new Promise(C=>{let H=document.createElement("lm-extinfo");H.operator=r||"",H.dark=!!A.data?.__dark,H.addEventListener("done",e=>{C(e.detail),H.remove()}),document.body.appendChild(H)}))return!1;try{let C=await A.api.ws("external/consent",{accept:!0});return A.data&&(A.data.external=C.external),A.changed(),!0}catch(C){return A.notify(C.message),!1}}async function x7(r,V){let C=(A.data?.models||[]).find(i=>i.id===r),H=tC(r),e=!r1().consent;if(!await B2(H))return!1;if(e)return!0;let L=C?.price?` Ein Schritt kostet grob ${G(r0(C.price),3)}.`:"";return v1(`${C?.name||"Dieses Modell"} l\xE4uft kostenpflichtig bei ${H}.${V?" Der bisherige Verlauf dieses Chats wird mitgeschickt.":""}${L} Bitte keine sensiblen Daten eingeben.`,"Weiter")}var C2=class extends C1{constructor(){super(...arguments);this.operator="";this.dark=!1;this.read=!1}done(C){this.dispatchEvent(new CustomEvent("done",{detail:C}))}render(){return t`<div class="back" @click=${C=>C.target===C.currentTarget&&this.done(!1)}>
      <div class="box" role="dialog" aria-modal="true"><h2>${d("euro",22)} Kostenpflichtige externe KI-Modelle</h2>
        ${u7(this.operator||void 0)}
        <label><input type="checkbox" .checked=${this.read} @change=${C=>this.read=C.target.checked}>
          Ich habe das gelesen und gebe in Chats mit externen Modellen keine sensiblen Informationen ein.</label>
        <div class="row" style="justify-content:flex-end;flex-wrap:wrap">
          <button class="btn" @click=${()=>this.done(!1)}>${p("Abbrechen")}</button>
          <button class="btn primary" ?disabled=${!this.read} @click=${()=>this.done(!0)}>${d("check",16)} Zustimmen und fortfahren</button></div>
      </div></div>`}};C2.styles=[p5,j,u5,B`
    .back { position: fixed; inset: 0; background: rgba(0,0,0,.4); display: grid; place-items: center; z-index: 9999; animation: fadeIn .15s; padding: 16px;
      padding-top: calc(16px + var(--safe-area-inset-top, 0px)); padding-bottom: calc(16px + var(--safe-area-inset-bottom, 0px)); }
    .box { background: var(--lm-panel); color: var(--lm-text); border-radius: 18px; padding: 20px 22px; width: min(560px, 100%);
      max-height: calc(100vh - 32px); overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,.3); }
    h2 { margin: 0 0 12px; font-size: 18px; display: flex; gap: 8px; align-items: center; }
    label { display: flex; gap: 8px; align-items: flex-start; font-size: 14px; margin: 12px 0 16px; cursor: pointer; }
    label input { width: auto; margin-top: 3px; }`],h([T()],C2.prototype,"operator",2),h([T({type:Boolean,reflect:!0})],C2.prototype,"dark",2),h([k()],C2.prototype,"read",2),C2=h([F("lm-extinfo")],C2);function h7(r,V,C,H){if(!V?.models?.length||!H)return s;let e=async i=>{if(await x7(i,!0))try{await A.api.ws("chat/switch_model",{chat_id:r,model:i});let M=await A.api.ws("chat/retry",{chat_id:r});A.chats.set(r,M.chat),A.changed()}catch(M){A.notify(String(M.message||M))}},L=V.models.find(i=>i.id===V.recommended)||V.models[0];return C?t`<div class="offer">
    <div>${d("euro",16)} Es gibt einen <b>kostenpflichtigen Ersatz</b> (${L.operator}), mit dem es sofort weitergehen kann.</div>
    <div class="brow"><button class="btn primary" @click=${()=>e(L.id)}>Mit dem Ersatz weitermachen</button></div></div>`:t`<div class="offer">
    <div>${d("euro",16)} Der Hauptanbieter ist gerade nicht nutzbar${V.reason?` (${V.reason})`:""}. Diese kostenpflichtigen Modelle sind freigeschaltet:</div>
    <div class="brow">${V.models.slice(0,4).map(i=>t`<button class="btn ${i.id===L.id?"primary":""}" title=${`${i.provider_name} \xB7 ${v5(i.price)}`}
      @click=${()=>e(i.id)}>${i.name} <span class="muted" style="font-size:12px">· ~${G(r0(i.price),3)}/Schritt</span></button>`)}</div></div>`}var _9=["H\xF6rt genau hin","Sortiert Silben","F\xFCgt W\xF6rter zusammen","Entziffert Genuschel","Setzt Satzzeichen","Bringt es zu Papier"],_2=new Map,E9="neu:startseite",Z7=r=>`neu:projekt:${r}`,z=class extends C1{constructor(){super(...arguments);this.placeholder="";this.mode="chat";this.showMode=!1;this.showProject=!1;this.projectId=null;this.model="";this.busy=!1;this.chatUsage=null;this.tools=null;this.big=!1;this.simple=!1;this.history=!1;this.draftKey="";this.text="";this.files=[];this.rec=null;this.recStart=0;this.recLevel=0;this.transcribing=!1;this.txStart=0;this.txNow=0;this.drag=!1;this.dismissed=new Set;this._raf=0;this._txTimer=0;this._txRun=0}get models(){return A.data?.models||[]}get modelInfo(){return this.models.find(C=>C.id===this.model)||{id:this.model,name:this.model}}focus(){this.ta?.focus()}setText(C){this.text=C,this.updateComplete.then(()=>this.autosize())}autosize(){let C=this.ta;C&&(C.style.height="auto",C.style.height=Math.min(C.scrollHeight,window.innerHeight*.4)+"px")}get canQueue(){return this.busy&&!!(this.text.trim()||this.files.length)}stopRun(){this.dispatchEvent(new CustomEvent("stop"))}send(){if(this.busy&&!this.canQueue){this.stopRun();return}let C=this.text.trim();if(!C&&!this.files.length)return;let H={text:C,files:this.files,model:this.model,mode:this.mode,tools:this.tools,project_id:this.projectId};this.dispatchEvent(new CustomEvent("send",{detail:H})),this.text="",this.files=[],this.draftKey&&_2.delete(this.draftKey),this.updateComplete.then(()=>this.autosize())}key(C){let H=A.data?.settings?.send_on_enter!==!1,e=matchMedia("(pointer: coarse)").matches;C.key==="Enter"&&!C.shiftKey&&!C.isComposing&&H&&!e&&(C.preventDefault(),(!this.busy||this.canQueue)&&this.send())}saveDraft(){this.draftKey&&(this.text||this.files.length?_2.set(this.draftKey,{text:this.text,files:this.files}):_2.delete(this.draftKey))}willUpdate(C){if(!C.has("draftKey"))return;let H=C.get("draftKey");H!==void 0&&H!==this.draftKey&&(this.text||this.files.length?_2.set(H,{text:this.text,files:this.files}):_2.delete(H));let e=this.draftKey?_2.get(this.draftKey):void 0;this.text=e?.text||"",this.files=e?.files?[...e.files]:[],this.updateComplete.then(()=>this.autosize())}addFiles(C){C&&(this.files=[...this.files,...Array.from(C)].slice(0,10))}async toggleRec(){if(this.rec)return this.stopRec(!0);if(!d5.supported())return this.webSpeech();try{let C=new d5;await C.start(),this.rec=C,this.recStart=Date.now();let H=()=>{this.rec&&(this.recLevel=this.rec.level,this._raf=requestAnimationFrame(H))};H()}catch(C){let H=C?.name==="NotAllowedError"||C?.name==="SecurityError";A.notify(H?"Mikrofon gesperrt. Ist die Berechtigung erteilt, blockiert vermutlich der Webserver (Header Permissions-Policy: microphone=()) \u2013 dort microphone=(self) erlauben.":"Mikrofon nicht verf\xFCgbar: "+(C?.message||C))}}async stopRec(C){let H=this.rec;if(!H)return;if(this.rec=null,cancelAnimationFrame(this._raf),!C){H.cancel();return}let e=++this._txRun;this.transcribing=!0,this.txStart=this.txNow=Date.now(),clearInterval(this._txTimer),this._txTimer=window.setInterval(()=>this.txNow=Date.now(),500);try{let L=await H.stop();if(e!==this._txRun)return;if(L.size<8e3){this.endTranscribing();return}let i=await A.api.transcribe(L);if(e!==this._txRun)return;this.endTranscribing(),i&&this.setText((this.text?this.text.trimEnd()+" ":"")+i),this.updateComplete.then(()=>this.focus())}catch(L){if(e!==this._txRun)return;this.endTranscribing(),A.notify(String(L?.message||L))}}endTranscribing(){this.transcribing=!1,clearInterval(this._txTimer)}cancelTranscribe(){this._txRun++,this.endTranscribing(),this.updateComplete.then(()=>this.focus())}disconnectedCallback(){super.disconnectedCallback(),this.saveDraft(),clearInterval(this._txTimer),cancelAnimationFrame(this._raf)}transcribingRow(){let C=Math.floor((this.txNow-this.txStart)/1e3),H=p(_9[Math.floor((this.txNow-this.txStart)/2600)%_9.length]);return t`<div class="tx" role="status" aria-live="polite">
      <svg class="txicon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"
          stroke-linecap="round" aria-hidden="true">
        <line class="b b1" x1="2.5" y1="9" x2="2.5" y2="15"/><line class="b b2" x1="5.75" y1="5.5" x2="5.75" y2="18.5"/>
        <line class="b b3" x1="9" y1="8" x2="9" y2="16"/>
        <circle class="p p1" cx="11.4" cy="12" r=".9" fill="currentColor" stroke="none"/>
        <circle class="p p2" cx="11.4" cy="12" r=".9" fill="currentColor" stroke="none"/>
        <line class="l l1" x1="14.5" y1="7.5" x2="21.5" y2="7.5" pathLength="1"/>
        <line class="l l2" x1="14.5" y1="12" x2="20.5" y2="12" pathLength="1"/>
        <line class="l l3" x1="14.5" y1="16.5" x2="18.5" y2="16.5" pathLength="1"/>
      </svg>
      <span class="shimmer ellipsis">${H} …</span>
      ${C>=2?t`<span class="muted txtime">${x1(C)}</span>`:s}
      <span class="grow"></span>
      <button class="iconbtn" title=${p("Abbrechen")} @click=${this.cancelTranscribe}>${d("close",18)}</button></div>`}webSpeech(){let C=window.SpeechRecognition||window.webkitSpeechRecognition;if(!C){A.notify("Spracheingabe wird von diesem Browser nicht unterst\xFCtzt.");return}let H=new C;H.lang=A.api.hass.language||"de-DE",H.interimResults=!1,H.onresult=e=>this.setText((this.text?this.text+" ":"")+e.results[0][0].transcript),H.start()}usageMenu(){let C=A.data?.usage||{},H=C.today||{},e=C.quota||{},L=C.key_limits||{},i=this.chatUsage,M=i?.context&&i?.context_max?i.context/i.context_max:0,o=(H.prompt||0)+(H.completion||0),l=(b,x)=>x?Math.min(1,b/x):0,a=b=>b>=.9?"e":b>=.7?"w":"",m=b=>t`<div class="bar2"><i class=${a(b)} style="width:${Math.round(b*100)}%"></i></div>`,c=L.limit_requests_day?1-(L.remaining_requests_day??L.limit_requests_day)/L.limit_requests_day:0,u=L.limit_requests_hour?1-(L.remaining_requests_hour??L.limit_requests_hour)/L.limit_requests_hour:0;return t`<div class="stats">
      ${i?t`<div><div class="k"><b>${p("Kontext")}</b><span>${I(i.context||0)} / ${I(i.context_max||this.modelInfo.context||0)}</span></div>${m(M)}
        <div class="hint">Wird es voll, kürzt LLMitMir ältere Werkzeugergebnisse und dann die ältesten Nachrichten.</div></div>`:s}
      <div><div class="k"><b>${p("Heute")}</b><span>${H.requests||0} Anfragen · ${I(o)} Tokens</span></div>
        ${e.requests_day?t`<div class="k muted"><span>Kontingent Anfragen</span><span>${H.requests||0} / ${e.requests_day}</span></div>${m(l(H.requests,e.requests_day))}`:s}
        ${e.tokens_day?t`<div class="k muted"><span>Kontingent Tokens</span><span>${I(o)} / ${I(e.tokens_day)}</span></div>${m(l(o,e.tokens_day))}`:s}
        ${!e.requests_day&&!e.tokens_day?t`<div class="hint">Kein persönliches Tageskontingent.</div>`:s}</div>
      ${C.week||C.month?t`<div><div class="k"><b>${p("Diese Woche")}</b><span>${C.week?.requests||0} Anfragen · ${I((C.week?.prompt||0)+(C.week?.completion||0))} Tokens</span></div>
        <div class="k"><b>${p("Diesen Monat")}</b><span>${C.month?.requests||0} Anfragen · ${I((C.month?.prompt||0)+(C.month?.completion||0))} Tokens</span></div>
        <div class="hint">Woche ab Montag, Monat ab dem Ersten – gezählt wird, was auf dem eigenen Schlüssel läuft.</div></div>`:s}
      ${L.limit_requests_day?t`<div><div class="k"><b>${p("Schl\xFCssel")}</b><span>${C.key_mode==="shared"?"gemeinsam":"pers\xF6nlich"}</span></div>
        <div class="k muted"><span>Heute übrig</span><span>${L.remaining_requests_day} / ${L.limit_requests_day}</span></div>${m(c)}
        <div class="k muted"><span>Diese Stunde übrig</span><span>${L.remaining_requests_hour} / ${L.limit_requests_hour}</span></div>${m(u)}
        ${L.reset_requests_day?t`<div class="hint">Tageslimit setzt in ${x1(L.reset_requests_day)} zurück.</div>`:s}</div>`:t`<div class="hint">Limits des Schlüssels erscheinen nach der ersten Anfrage.</div>`}
      ${r1().has_access?t`<div><div class="k"><b>Kostenpflichtig (extern)</b><span>${G(r1().month_eur)} / ${G(r1().limit_eur)}</span></div>
        ${m(l(r1().month_eur,r1().limit_eur))}<div class="hint">Diesen Monat · Limit vom Admin</div></div>`:s}
    </div>`}quotaFrac(){let C=A.data?.usage||{},H=C.today||{},e=C.quota||{},L=C.key_limits||{},i=(H.prompt||0)+(H.completion||0),M=[e.requests_day?H.requests/e.requests_day:0,e.tokens_day?i/e.tokens_day:0,L.limit_requests_day?1-(L.remaining_requests_day??L.limit_requests_day)/L.limit_requests_day:0,L.limit_requests_hour?1-(L.remaining_requests_hour??L.limit_requests_hour)/L.limit_requests_hour:0];return Math.max(...M.map(o=>o||0))}get modelRole(){return this.mode==="chat"?"chat":"agent"}async pickModel(C){h1(C)&&C!==this.model&&!await x7(C,this.history)||(this.model=C,this.dispatchEvent(new CustomEvent("model",{detail:C})))}modelMenu(){let C=A.data,H=this.modelRole,e=C?.defaults?.[H],L=C?.defaults?.auto?.[H],i=[...this.models].sort((a,m)=>(a.blended||0)-(m.blended||0)||(m.quality?.[H]||0)-(a.quality?.[H]||0)),M=i.filter(a=>!a.external),o=i.filter(a=>a.external),l=a=>{let m=P2(a),c=a.external&&(a.locked||!a.usable);return t`<button class="mi ${a.id===this.model?"sel":""}" ?data-close=${!c} ?disabled=${c} style=${c?"opacity:.55;cursor:default":""}
        title=${c&&a.why||""} @click=${()=>{c||this.pickModel(a.id)}}>
        <div class="grow"><div class="row">${a.external?d(c?"lock":"euro",14):m5(a)}<span class="ellipsis">${a.name}</span>${a.id===e?t`<span class="badge">Standard</span>`:s}
          ${a.id===L&&a.id!==e?t`<span class="badge" style="color:var(--lm-accent)">Empfohlen</span>`:s}
          ${a.new?t`<span class="badge" style="color:var(--lm-accent)">neu</span>`:s}
          ${a.external&&a.locked?t`<span class="badge">nur im Notfall</span>`:s}
          ${a.status==="unavailable"?t`<span class="badge" style="color:var(--lm-err)">nicht verfügbar</span>`:s}</div>
          <div class="sub">${a.external?t`${a.provider_name} · ~${G(r0(a.price),3)} je Schritt${c&&a.why?t` · ${a.why}`:s}`:t`${m&&m.level?t`<span style="color:${m.color}">${m.text}</span> · `:s}${(a.input||[]).includes("image")?"Bilder \xB7 ":""}${(a.output||[]).includes("thought")?"denkt nach \xB7 ":""}${I(a.context)} Kontext`}</div></div>
        ${a.id===this.model?d("check",18):s}</button>`};return t`<div class="mh">${p("Modell")}</div>
      ${M.map(l)}
      ${o.length?t`<div class="msep"></div><div class="mh">Kostenpflichtig (extern)</div>${o.map(l)}
        <div class="hint" style="padding:2px 10px 6px">${G(r1().month_eur)} von ${G(r1().limit_eur)} diesen Monat verbraucht. Externe Modelle laufen bei
          einem anderen Anbieter – keine sensiblen Daten eingeben. ${o.some(a=>a.locked)?"\u201ENur im Notfall\u201C hei\xDFt: erst w\xE4hlbar, wenn die Anbieter davor gerade nicht nutzbar sind.":""}</div>`:s}
      <div class="msep"></div><div class="hint" style="padding:4px 10px 6px">Der Punkt zeigt die aktuelle Auslastung beim Anbieter (grün frei, gelb etwas, rot stark).
        „Standard“ wählt automatisch das passendste Modell, das gerade nicht überlastet ist.</div>`}emergencyHint(){let C=r1();if(this.simple||this.busy||!C.emergency||h1(this.model)||this.dismissed.has("__emergency"))return s;let H=this.models.filter(L=>L.external&&!L.locked&&L.usable);if(!H.length)return s;let e=H.sort((L,i)=>(L.blended||0)-(i.blended||0))[0];return t`<div class="bhint">${d("euro",18)}<div class="grow">Der Hauptanbieter ist gerade nicht nutzbar${C.main_why?` (${C.main_why})`:""}.
        Kostenpflichtige Ersatzmodelle sind im Modellmenü freigeschaltet – z. B. <b>${e.name}</b> (${v5(e.price)}).</div>
      <button class="btn" @click=${()=>this.pickModel(e.id)}>${e.name} nehmen</button>
      <button class="iconbtn" title=${p("Schlie\xDFen")} @click=${()=>{this.dismissed=new Set([...this.dismissed,"__emergency"])}}>${d("close",16)}</button></div>`}busyHint(){let C=this.modelInfo;if(this.simple||this.busy||!C?.busy||C.external||this.dismissed.has(C.id))return s;let H=this.files.some(L=>L.type.startsWith("image/"))&&(C.input||[]).includes("image"),e=B9(C.id,this.modelRole,H);return t`<div class="bhint">${d("hourglass",18)}<div class="grow"><b>${C.name}</b> ist gerade ${P2(C)?.text||"stark ausgelastet"} – Antworten können
        sich um Minuten verzögern.${e?t` <b>${e.name}</b> ist frei und ${e.better?"mindestens genauso stark":e.similar?"l\xF6st das \xE4hnlich gut":"etwas schw\xE4cher, aber deutlich schneller"}.`:" Gerade ist kein \xE4hnlich gutes Modell frei."}</div>
      ${e?t`<button class="btn" @click=${()=>this.pickModel(e.id)}>${e.name} nehmen</button>`:s}
      <button class="iconbtn" title=${p("Schlie\xDFen")} @click=${()=>{this.dismissed=new Set([...this.dismissed,C.id])}}>${d("close",16)}</button></div>`}toolsMenu(){let C=A.data?.tool_groups||{},H=new Set(this.tools??A.data?.settings?.chat_tools??["web","files","skills"]),e=["web","files","skills","dav","ews","http",...A.data?.werkbank?.configured?["werkbank"]:[]];return t`<div class="mh">${p("Werkzeuge")} im Chat</div>
      ${e.map(L=>t`<button class="mi" @click=${()=>{H.has(L)?H.delete(L):H.add(L),this.tools=[...H],this.dispatchEvent(new CustomEvent("tools",{detail:this.tools})),this.requestUpdate()}}>
        ${d(C[L]?.icon||"tools",18)}<span class="grow">${C[L]?.label||L}</span>${H.has(L)?d("check",18):s}</button>`)}
      <div class="hint" style="padding:4px 10px 6px">${C.ha?.label||"Home Assistant"} ist immer dabei. Im Cowork stehen alle Werkzeuge zur Verfügung; schreibende Aktionen fragen nach.</div>`}projectMenu(){let C=A.data?.projects||[];return t`<div class="mh">${p("Projekte")}</div>
      <button class="mi ${this.projectId?"":"sel"}" data-close @click=${()=>{this.projectId=null,this.dispatchEvent(new CustomEvent("project",{detail:null}))}}>
        ${d("chat",18)} Ohne Projekt</button>
      ${C.map(H=>t`<button class="mi ${H.id===this.projectId?"sel":""}" data-close
        @click=${()=>{this.projectId=H.id,this.dispatchEvent(new CustomEvent("project",{detail:H.id}))}}>
        ${d("project",18)}<span class="grow ellipsis">${H.name}</span></button>`)}`}render(){let C=this.busy,H=(A.data?.projects||[]).find(o=>o.id===this.projectId),e=this.quotaFrac(),L=this.chatUsage,i=L?.context&&L?.context_max?L.context/L.context_max:0,M=this.rec?Math.floor((Date.now()-this.recStart)/1e3):0;return t`${this.busyHint()}${this.emergencyHint()}<div class="box ${this.big?"big":""} ${this.drag?"drag":""}"
        @dragover=${o=>{o.preventDefault(),this.drag=!0}} @dragleave=${()=>this.drag=!1}
        @drop=${o=>{o.preventDefault(),this.drag=!1,this.addFiles(o.dataTransfer?.files||null)}}>
      ${this.files.length?t`<div class="files">${this.files.map((o,l)=>t`<span class="file">${d(o.type.startsWith("image/")?"image":"file",16)}
        <span class="ellipsis">${o.name}</span><button @click=${()=>this.files=this.files.filter((a,m)=>m!==l)}>${d("close",16)}</button></span>`)}</div>`:s}
      ${this.rec?t`<div class="rec"><span class="dot"></span><span class="muted">${x1(M)}</span>
          <div class="wave">${Array.from({length:28},(o,l)=>t`<i style="height:${4+Math.abs(Math.sin(l*1.7+Date.now()/160))*this.recLevel*24}px"></i>`)}</div>
          <button class="iconbtn" title=${p("Abbrechen")} @click=${()=>this.stopRec(!1)}>${d("close")}</button>
          <button class="send" title="Fertig" @click=${()=>this.stopRec(!0)}>${d("check")}</button></div>`:this.transcribing?this.transcribingRow():t`<textarea rows="1" .value=${this.text} placeholder=${this.placeholder}
          @input=${o=>{this.text=o.target.value,this.autosize()}} @keydown=${this.key}
          @paste=${o=>{let l=o.clipboardData?.files;l?.length&&(o.preventDefault(),this.addFiles(l))}}></textarea>`}
      <div class="bar">
        <label class="iconbtn" title=${p("Anh\xE4ngen")}>${d("attach")}<input type="file" multiple hidden
          @change=${o=>{this.addFiles(o.target.files),o.target.value=""}}></label>
        ${this.mode==="chat"&&!this.simple?t`<lm-menu direction="up"><button slot="trigger" class="iconbtn ${this.tools?.length,""}" title=${p("Werkzeuge")}>${d("tools")}</button>${this.toolsMenu()}</lm-menu>`:s}
        ${this.showMode?t`<span class="seg">
          <button class=${this.mode==="chat"?"on":""} @click=${()=>this.setMode("chat")}>${d("chat",16)}<span class="hide-s">Chat</span></button>
          <button class=${this.mode==="cowork"?"on":""} @click=${()=>this.setMode("cowork")}>${d("cowork",16)}<span class="hide-s">Cowork</span></button></span>`:s}
        ${this.showProject?t`<lm-menu direction="up"><button slot="trigger" class="model" title=${p("Projekte")}>${d("project",16)}<span class="ellipsis hide-s">${H?.name||"Projekt"}</span></button>${this.projectMenu()}</lm-menu>`:s}
        <span class="grow"></span>
        ${this.simple?s:t`<lm-menu direction="up" align="right"><button slot="trigger" class="meter" title="${p("Kontext")} & ${p("Kontingent")}">
          ${L?t`<lm-ring .value=${i} label=${p("Kontext")}></lm-ring>`:s}<lm-ring .value=${e} label=${p("Kontingent")}></lm-ring></button>
          ${this.usageMenu()}</lm-menu>
        <lm-menu direction="up" align="right"><button slot="trigger" class="model" title=${p("Modell")}>${this.modelInfo.external?d("euro",14):m5(this.modelInfo,7)}<span class="ellipsis">${this.modelInfo.name||"Modell w\xE4hlen"}</span>${d("down",16)}</button>${this.modelMenu()}</lm-menu>`}
        ${!C&&!this.rec&&(this.transcribing||!this.text.trim()&&!this.files.length)?t`<button class="send" title=${p("Spracheingabe")} style="background:var(--lm-hover);color:var(--lm-text)"
            @click=${this.toggleRec} ?disabled=${this.transcribing}>${d("mic")}</button>`:this.rec?s:C&&!this.canQueue?t`<button class="send stop" title=${p("Stopp")} @click=${this.stopRun}>${d("stop")}</button>`:t`<button class="send" title=${C?p("Senden \u2013 kommt nach der laufenden Antwort dran"):p("Senden")} @click=${this.send}>${d("send")}</button>`}
      </div></div>`}setMode(C){this.mode=C;let H=A.data?.defaults||{},e=(A.data?.projects||[]).find(L=>L.id===this.projectId);this.model=(C==="chat"?e?.model_chat||H.chat:e?.model_agent||H.agent)||this.model,this.dispatchEvent(new CustomEvent("mode",{detail:C}))}};z.styles=[j,$2,B`
    :host { display: block; container-type: inline-size; }
    .box { background: var(--lm-raise); border: 1px solid var(--lm-line); border-radius: 22px; box-shadow: var(--lm-shadow);
      padding: 12px 12px 8px 16px; transition: border-color .2s, box-shadow .2s; position: relative; }
    .box:focus-within { border-color: color-mix(in srgb, var(--lm-accent) 45%, var(--lm-line)); }
    .box.drag { border-color: var(--lm-accent); box-shadow: 0 0 0 4px var(--lm-accent-soft); }
    textarea { border: 0; background: transparent; padding: 4px 0; resize: none; min-height: 28px; max-height: 40vh; font-size: 16px;
      line-height: 1.5; box-shadow: none !important; }
    .big textarea { min-height: 56px; }
    .bar { display: flex; align-items: center; gap: 4px; margin-top: 6px; flex-wrap: nowrap; }
    .send { width: 36px; height: 36px; border-radius: 11px; border: 0; background: var(--lm-accent); color: var(--lm-on-accent); display: grid;
      place-items: center; cursor: pointer; transition: transform .12s, background .15s, opacity .15s; flex: none; }
    .send:hover { background: var(--lm-accent-2); } .send:active { transform: scale(.94); }
    .send[disabled] { opacity: .35; cursor: default; }
    .send.stop { background: var(--lm-text); color: var(--lm-bg); }
    .seg { display: inline-flex; background: var(--lm-hover); border-radius: 10px; padding: 3px; gap: 2px; }
    .seg button { border: 0; background: none; padding: 5px 10px; border-radius: 8px; cursor: pointer; font-size: 13px; color: var(--lm-muted);
      display: inline-flex; gap: 5px; align-items: center; }
    .seg button.on { background: var(--lm-raise); color: var(--lm-text); box-shadow: 0 1px 3px rgba(0,0,0,.08); }
    .model { display: inline-flex; align-items: center; gap: 4px; border: 0; background: none; color: var(--lm-muted); font-size: 13px;
      padding: 6px 8px; border-radius: 9px; cursor: pointer; max-width: 210px; }
    .model:hover { background: var(--lm-hover); color: var(--lm-text); }
    /* Hinweis ueber dem Eingabefeld: Text bekommt mindestens 12em, der Knopf rutscht
       sonst in die naechste Zeile statt den Text auf ein Wort je Zeile zu quetschen */
    .bhint { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 10px; margin: 0 6px 8px; padding: 9px 10px 9px 12px;
      border-radius: 14px; font-size: 13.5px; background: color-mix(in srgb, var(--lm-warn) 12%, var(--lm-panel));
      border: 1px solid color-mix(in srgb, var(--lm-warn) 35%, var(--lm-line)); color: var(--lm-text); animation: fadeIn .2s; }
    .bhint > svg { color: var(--lm-warn); flex: none; }
    .bhint > .grow { flex: 1 1 12em; min-width: 0; }
    .bhint .btn { white-space: nowrap; flex: 0 0 auto; max-width: 100%; overflow: hidden; text-overflow: ellipsis; }
    .bhint .iconbtn { flex: none; }
    /* Schmal: Symbol, Text und Schliessen in der ersten Zeile, der Knopf darunter –
       sonst quetscht der Knopf den Text auf ein Wort je Zeile */
    @container (max-width: 520px) {
      .bhint { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: start; }
      .bhint > .grow { grid-column: 2; }
      .bhint .btn { grid-column: 2; justify-self: start; margin-top: 2px; }
      .bhint .iconbtn { grid-column: 3; grid-row: 1; }
    }
    .files { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
    .file { display: inline-flex; align-items: center; gap: 6px; background: var(--lm-hover); border-radius: 10px; padding: 5px 6px 5px 10px;
      font-size: 12.5px; max-width: 240px; animation: fadeIn .2s; }
    .file button { border: 0; background: none; cursor: pointer; color: var(--lm-muted); display: grid; }
    .meter { display: inline-flex; align-items: center; gap: 2px; border: 0; background: none; padding: 6px; border-radius: 9px; cursor: pointer; }
    .meter:hover { background: var(--lm-hover); }
    .stats { padding: 8px 10px; font-size: 13px; display: grid; gap: 10px; min-width: min(270px, calc(100vw - 40px)); text-align: left; }
    .stats .bar2 { height: 6px; border-radius: 4px; background: var(--lm-hover); overflow: hidden; margin-top: 4px; }
    .stats .bar2 i { display: block; height: 100%; background: var(--lm-accent); border-radius: 4px; transition: width .5s; }
    .stats .bar2 i.w { background: var(--lm-warn); } .stats .bar2 i.e { background: var(--lm-err); }
    .stats .k { display: flex; justify-content: space-between; gap: 10px; }
    .rec { display: flex; align-items: center; gap: 12px; padding: 6px 2px; }
    .wave { display: flex; align-items: center; gap: 3px; height: 28px; flex: 1; }
    .wave i { width: 3px; border-radius: 2px; background: var(--lm-accent); transition: height .1s; }
    .dot { width: 9px; height: 9px; border-radius: 50%; background: var(--lm-err); animation: blink 1s infinite; }
    @keyframes blink { 50% { opacity: .3; } }
    .tx { display: flex; align-items: center; gap: 10px; padding: 2px 0; min-height: 36px; font-size: 15px; }
    .tx .txtime { font-size: 12.5px; flex: none; }
    .tx .iconbtn { width: 30px; height: 30px; }
    .txicon { flex: none; color: var(--lm-accent); overflow: visible; }
    .txicon .b { transform-box: fill-box; transform-origin: center; animation: txbar 1.1s ease-in-out infinite; }
    .txicon .b2 { animation-delay: -.35s; } .txicon .b3 { animation-delay: -.7s; }
    .txicon .p { opacity: 0; animation: txflow 1.1s ease-in infinite; } .txicon .p2 { animation-delay: -.55s; }
    .txicon .l { stroke-dasharray: 1; stroke-dashoffset: 1; animation: txwrite 2.6s ease-out infinite; }
    .txicon .l2 { animation-delay: .3s; } .txicon .l3 { animation-delay: .6s; }
    @keyframes txbar { 0%, 100% { transform: scaleY(.35); } 50% { transform: scaleY(1); } }
    @keyframes txflow { 0% { opacity: 0; transform: translateX(-1.5px); } 35% { opacity: .9; } 100% { opacity: 0; transform: translateX(2.5px); } }
    @keyframes txwrite { 0% { stroke-dashoffset: 1; opacity: 1; } 30%, 75% { stroke-dashoffset: 0; opacity: 1; } 92%, 100% { stroke-dashoffset: 0; opacity: 0; } }
    @media (prefers-reduced-motion: reduce) {
      .txicon .b, .txicon .p, .txicon .l, .tx .shimmer { animation: none; } .txicon .l { stroke-dashoffset: 0; }
      .tx .shimmer { color: var(--lm-muted); background: none; }
    }
    .badge { font-size: 10.5px; padding: 1px 6px; border-radius: 6px; background: var(--lm-hover); color: var(--lm-muted); margin-left: 4px; }
    .tool-on { color: var(--lm-accent); }
    @container (max-width: 560px) {
      .box { border-radius: 18px; padding: 10px 10px 6px 12px; }
      .model { max-width: 96px; padding: 6px 4px; } .hide-s { display: none; }
      .bar { gap: 1px; } .iconbtn { width: 32px; } .seg button { padding: 5px 7px; } .meter { padding: 4px; }
    }
  `],h([T()],z.prototype,"placeholder",2),h([T()],z.prototype,"mode",2),h([T({type:Boolean})],z.prototype,"showMode",2),h([T({type:Boolean})],z.prototype,"showProject",2),h([T()],z.prototype,"projectId",2),h([T()],z.prototype,"model",2),h([T({type:Boolean})],z.prototype,"busy",2),h([T({type:Object})],z.prototype,"chatUsage",2),h([T({type:Array})],z.prototype,"tools",2),h([T({type:Boolean})],z.prototype,"big",2),h([T({type:Boolean})],z.prototype,"simple",2),h([T({type:Boolean})],z.prototype,"history",2),h([T()],z.prototype,"draftKey",2),h([k()],z.prototype,"text",2),h([k()],z.prototype,"files",2),h([k()],z.prototype,"rec",2),h([k()],z.prototype,"recStart",2),h([k()],z.prototype,"recLevel",2),h([k()],z.prototype,"transcribing",2),h([k()],z.prototype,"txStart",2),h([k()],z.prototype,"txNow",2),h([k()],z.prototype,"drag",2),h([k()],z.prototype,"dismissed",2),h([D5("textarea")],z.prototype,"ta",2),z=h([F("lm-composer")],z);var rC={queued:"In der Warteschlange \u2026",thinking:"Denkt nach \u2026",streaming:"Schreibt \u2026",tool:"Arbeitet \u2026",waiting_permission:"Wartet auf Freigabe",retry:"Modell ausgelastet \u2013 neuer Versuch",quota_wait:"Limit erreicht \u2013 wartet"},z9={skill:["Skill","mdi:school-outline","Skills"],aufgabe:["Geplante Aufgabe","mdi:calendar-clock-outline","Geplant"],zugang:["Zugang","mdi:key-outline","Zug\xE4nge"]},iC={anlegen:["neu","add"],aendern:["\xE4ndern","upd"],loeschen:["l\xF6schen","del"]},MC={web:"Sucht im Internet \u2026",ha:"Schaut im Zuhause nach \u2026",dav:"Schaut in deiner Nextcloud nach \u2026",ews:"Schaut in deinen Exchange-Kalender \u2026",http:"Fragt einen Dienst ab \u2026",files:"Liest Dateien \u2026",skills:"Liest eine Anleitung \u2026",werkbank:"Rechnet und erstellt Dateien \u2026",notify:"Schickt eine Nachricht \u2026",progress:"Plant die n\xE4chsten Schritte \u2026",llmitmir:"Schaut in LLMitMir nach \u2026",model:"Schaut sich den Anhang an \u2026"},aC={web:"das Internet",dav:"deine Nextcloud",ews:"dein Exchange-Kalender",http:"Abfragen bei anderen Diensten",files:"Dateien",notify:"Benachrichtigungen",skills:"deine Anleitungen (Skills)",werkbank:"die Werkbank (Programme ausf\xFChren)",ha:"Home Assistant"},oC={skill:"den Skill",aufgabe:"die geplante Aufgabe",zugang:"den Zugang"},N9=r=>typeof r=="number"?new Date(r*1e3):r?new Date(r):null,i0=r=>N9(r)?.toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"})||"";function nC(r){let V=N9(r);if(!V)return"";let C=new Date,H=new Date;return H.setDate(C.getDate()-1),V.toDateString()===C.toDateString()?"Heute":V.toDateString()===H.toDateString()?"Gestern":V.toLocaleDateString("de-DE",{weekday:"long",day:"numeric",month:"long",year:V.getFullYear()!==C.getFullYear()?"numeric":void 0})}var R9=r=>/Schlüssel|Kontingent|Limit|Admin|Einstellungen|Zustimmung|extern|Projekt/.test(r)?r:"Die KI hat gerade nicht richtig geantwortet. Versuch es bitte gleich noch einmal.",F9=r=>!!r?.streaming&&h1(r.model),S7=r=>typeof r=="string"&&(r.includes(`
`)||r.length>120);function D9(r){let V=String(r?.befehl??"").trim();if(!V)return[];let C=V.split(`
`).map(e=>e.trim()).filter(Boolean),H=C.slice(0,2).map(e=>e.length>110?e.slice(0,109)+"\u2026":e);return C.length>2&&(H[H.length-1]+=" \u2026"),H}function sC(r,V){let C;if(r.diff)C=t`<div class="diff">${r.diff.map(([H,e])=>H==="\u2026"?t`<div class="s">⋯ ${e} unveränderte Zeile${e===1?"":"n"}</div>`:t`<div class=${H==="+"?"a":H==="-"?"d":"c"}>${e||" "}</div>`)}</div>`;else if(V==="aendern")C=S7(r.alt)||S7(r.neu)?t`${r.alt?t`<div class="blk gone">${r.alt}</div>`:s}${r.neu?t`<div class="blk add">${r.neu}</div>`:t`<span class="old">leer</span>`}`:t`${r.alt?t`<span class="old">${r.alt}</span>`:t`<span class="muted">leer</span>`}<span class="arrow">→</span>${r.neu?t`<span class="new">${r.neu}</span>`:t`<span class="muted">leer</span>`}`;else{let H=V==="loeschen"?r.alt:r.neu;C=S7(H)?t`<div class="blk ${V==="loeschen"?"gone":""}">${H}</div>`:t`<span class=${V==="loeschen"?"gonetxt":""}>${H||"\u2013"}</span>`}return t`<div class="k">${r.feld}</div><div class="v">${C}</div>`}function g7(r,V){let[C,H]=z9[r.art]||[r.art,"mdi:tools"],[e,L]=iC[r.aktion]||[r.aktion,"upd"],i=V==="ok"?t`<span class="chip ok">${d("check",14)} übernommen</span>`:V==="denied"?t`<span class="chip warn">abgelehnt</span>`:V==="error"?t`<span class="chip err">fehlgeschlagen</span>`:V==="running"?t`<span class="spin"></span>`:s;return t`<div class="chg ${L}">
    <div class="chg-h">${d(H,18)}<span class="grow"><span class="muted">${C}</span> <b>${r.name}</b></span>
      <span class="badge ${L}">${e}</span>${i}</div>
    ${r.hinweis?t`<div class="chg-note">${d("alert",16)} ${r.hinweis}</div>`:s}
    ${r.felder?.length?t`<div class="chg-f">${r.felder.map(M=>sC(M,r.aktion))}</div>`:s}
  </div>`}var A1=class extends C1{constructor(){super(...arguments);this.chatId="";this.narrow=!1;this.openSteps=new Set;this.panel=!1;this.editTitle=!1;this.now=Date.now();this.hideHint="";this.stick=!0;this._selfScroll=!1;this._jumping=!1;this._pending=!1;this._onChange=()=>{this._pending||(this._pending=!0,setTimeout(()=>{this._pending=!1,this.requestUpdate(),this.updateComplete.then(()=>this.autoscroll())},16))}}connectedCallback(){super.connectedCallback(),A.addEventListener("change",this._onChange),this._tick=setInterval(()=>{A.runs[this.chatId]&&(this.now=Date.now())},1e3)}disconnectedCallback(){super.disconnectedCallback(),A.removeEventListener("change",this._onChange),clearInterval(this._tick)}updated(C){C.has("chatId")&&this.chatId&&(this.stick=!0,A.loadChat(this.chatId,!0).then(()=>this.updateComplete.then(()=>this.autoscroll(!0))).catch(H=>A.notify(String(H.message||H))),A.api.ws("chat/seen",{chat_id:this.chatId}).catch(()=>{}))}autoscroll(C=!1){let H=this.scroller;if(!H||!C&&!this.stick)return;let e=H.scrollHeight-H.clientHeight;e-H.scrollTop<2||(this._selfScroll=!0,H.scrollTop=e,setTimeout(()=>{this._selfScroll=!1},150))}onScroll(){let C=this.scroller;if(!C||this._jumping)return;let H=C.scrollHeight-C.scrollTop-C.clientHeight<24;this._selfScroll&&H||(this.stick=H)}jumpDown(){let C=this.scroller;C&&(this.stick=!0,this._jumping=!0,C.scrollTo({top:C.scrollHeight,behavior:"smooth"}),setTimeout(()=>{this._jumping=!1},700))}get chat(){return A.chats.get(this.chatId)}async send(C){let H=C.detail,e=this.chat;if(e)try{let L=[];H.files.length&&(L=(await A.api.upload("chat",e.id,H.files)).files.map(i=>i.name)),this.stick=!0,await A.api.ws("chat/send",{chat_id:e.id,text:H.text||"(siehe Anhang)",attachments:L,model:H.model,...e.kind==="chat"?{tools:H.tools}:{}})}catch(L){A.notify(String(L.message||L))}}stop(){A.api.ws("chat/stop",{chat_id:this.chatId})}retry(){A.api.ws("chat/retry",{chat_id:this.chatId}).then(C=>{A.chats.set(this.chatId,C.chat),A.changed()}).catch(C=>A.notify(C.message))}async openFile(C){try{window.open(await A.api.fileUrl("chat",this.chatId,C),"_blank")}catch(H){A.notify(H.message)}}stepRow(C){let H=this.openSteps.has(C.id),e=C.args||{},L=e.anfrage||e.url||e.pfad||e.name||e.entity_id||e.filter||e.typ||(e.domain?`${e.domain}.${e.service}`:"")||"",i=!H&&C.name==="shell"?D9(e):[],M=C.status;return t`<div class="step" @click=${()=>{let o=new Set(this.openSteps);H?o.delete(C.id):o.add(C.id),this.openSteps=o}}>
        <div class="srow">${d(C.icon||"tools",18)}<span class="lbl">${C.label||C.name}</span><span class="arg ellipsis">${L?`\xB7 ${String(L).slice(0,80)}`:""}</span>
        <span class="st">${M==="running"?t`<span class="spin"></span>`:M==="ok"?t`<span class="ok">${d("check",16)}</span>`:M==="denied"?t`<span class="den">${d("lock",16)}</span>`:t`<span class="err">${d("alert",16)}</span>`}
          ${C.ms?C.ms>1e3?(C.ms/1e3).toFixed(1).replace(".",",")+" s":C.ms+" ms":""}${d(H?"down":"right",16)}</span></div>
        ${i.length?t`<div class="prev">${i.map(o=>t`<div>${o}</div>`)}</div>`:s}</div>
      ${C.change?t`<div class="chgd">${g7(C.change,M)}</div>`:s}
      ${H?t`<div class="detail">${C.change?s:t`<b>Eingabe</b><pre>${JSON.stringify(C.args||{},null,2)}</pre>`}
        ${C.content?t`<b>Ergebnis</b><pre>${C.content.slice(0,6e3)}${C.content.length>6e3?`
\u2026`:""}</pre>`:s}</div>`:s}`}renderMessages(C,H){let e=[],L=C.messages||[],i=A.data?.settings?.show_reasoning!==!1,M=0,o=[...L].reverse().find(l=>l.role==="assistant"&&(l.content||l.error));for(;M<L.length;){let l=L[M];if(l.role==="user"){e.push(t`${l.attachments?.length?t`<div class="att">${l.attachments.map(c=>t`<button @click=${()=>this.openFile(c)}>${d("file",15)}${c}</button>`)}</div>`:s}
          <div class="user">${l.content}</div>`),M++;continue}if(l.role==="tool"){let c=[];for(;M<L.length&&L[M].role==="tool";)c.push(L[M]),M++;e.push(t`<div class="steps">${c.map(u=>this.stepRow(u))}</div>`);continue}let a=l.streaming&&H,m=l===o;e.push(t`<div class="asst ${m?"last":""}">
        ${l.reasoning&&i?t`<details class="think" ?open=${a&&!l.content}><summary>${d("brain",16)} ${a&&!l.content?t`<span class="shimmer">${p("Denkt nach \u2026")}</span>`:p("Gedanken")}</summary>
          <div class="txt">${l.reasoning}</div></details>`:s}
        ${l.content?t`<div class="md">${T1(l.content)}${a?t`<span class="caret"></span>`:s}</div>`:s}
        ${l.error?t`<div class="error">${d("alert")}<div class="grow"><b>Das hat nicht geklappt.</b><div>${l.error}</div>
            ${h7(C.id,l.offer,!1,m&&!H)}</div>
          <button class="btn" @click=${()=>this.retry()}>${d("retry",16)} ${p("Erneut versuchen")}</button></div>`:s}
        ${(l.content||l.error)&&!a?t`<div class="meta">
          ${l.content?t`<button class="iconbtn" title=${p("Kopieren")} @click=${()=>A2(l.content)}>${d("copy",16)}</button>`:s}
          ${m&&!H?t`<button class="iconbtn" title=${p("Erneut versuchen")} @click=${()=>this.retry()}>${d("retry",16)}</button>`:s}
          <span>${(A.data?.models||[]).find(c=>c.id===l.model)?.name||l.model||""}${h1(l.model)?" \xB7 extern":""}${l.usage?.completion?` \xB7 ${I(l.usage.completion)} Tokens`:""} · ${D(l.created)}</span></div>`:s}
      </div>`),M++}return e}queuedBubbles(C){let H=C.queued||[];if(!H.length)return s;let e=E();return t`<div class="queued">${H.map((L,i)=>t`<div class="qrow">
      ${e?t`<div class="bubble me">${L.content&&L.content!=="(siehe Anhang)"?t`<div class="btxt">${L.content}</div>`:s}</div>`:t`<div class="user">${L.content}</div>`}
      <div class="qmeta">${d("clock",14)}<span>${i===0?p("Kommt als N\xE4chstes dran"):p("Wartet \xB7 {n}.",{n:i+1})}</span>
        ${i===0&&!A.runs[C.id]?t`<button class="btn tiny" @click=${()=>this.resume()}><span>${p("Jetzt senden")}</span></button>`:s}
        <button class="iconbtn" title=${p("Zur\xFCcknehmen")} @click=${()=>this.unqueue(L.id)}>${d("close",15)}</button></div>
    </div>`)}</div>`}resume(){A.api.ws("chat/resume",{chat_id:this.chatId}).catch(C=>A.notify(String(C.message||C)))}unqueue(C){A.api.ws("chat/unqueue",{chat_id:this.chatId,message_id:C}).catch(H=>A.notify(String(H.message||H)))}runIndicator(C,H){if(!C)return s;let e=H.messages[H.messages.length-1];if(C.status==="streaming"&&e?.streaming&&e?.content)return s;if(C.status==="waiting_permission")return s;let L=C.detail||{},i=rC[C.status]||"Arbeitet \u2026";C.status==="tool"&&(i=(L.label||"Werkzeug")+" \u2026"),C.status==="retry"&&(i=`Modell ausgelastet \u2013 neuer Versuch in ${L.seconds} s (Versuch ${L.attempt})`),C.status==="quota_wait"&&(i=`Limit des Schl\xFCssels erreicht \u2013 geht in ${x1(L.seconds)} weiter`),C.status==="thinking"&&L.switched_from&&(i=h1(H.model)&&L.auto?`Hauptanbieter nicht nutzbar \u2013 weiter mit ${b1(H.model)} (kostenpflichtig) \u2013 denkt nach \u2026`:`${L.auto?"Automatisch gewechselt":"Gewechselt"} von ${b1(L.switched_from)} zu ${b1(H.model)} \u2013 denkt nach \u2026`);let M=this.now/1e3-(C.started||this.now/1e3),o=C.status==="tool"&&L.tool==="shell"&&D9(L.args)[0]||"";return t`<div class="running"><lm-spark></lm-spark><span class="shimmer">${i}</span>
      ${M>20?t`<span class="muted" style="font-size:12px">· ${x1(M)}</span>`:s}</div>
      ${o?t`<div class="runcmd">${o}</div>`:s}
      ${this.slowCard(C,H)}`}slowCard(C,H){let e=C.hint;if(!e||this.hideHint===C.run_id+e.model)return s;let L=Math.max(e.waited||0,Math.round(this.now/1e3-(e.since||this.now/1e3))),i=(e.demand??0)>=4,M=e.alt&&T2(e.alt.id)?{...e.alt,name:b1(e.alt.id)}:e.alt;return t`<div class="perm slow">
      <div class="row">${d("hourglass")}<b class="grow">${e.model_name} antwortet seit ${x1(L)} nicht</b></div>
      <div class="hint">${i?"Das Modell ist beim Anbieter gerade stark ausgelastet":"Das Modell kommt gerade nicht hinterher"} – so kann eine Antwort
        viele Minuten dauern.${M?t` <b>${M.name}</b> ist ${M.demand>=2?"weniger ausgelastet":"frei"} und ${M.better?"mindestens genauso stark":M.similar?"l\xF6st die Aufgabe \xE4hnlich gut":"etwas schw\xE4cher, aber deutlich schneller"}.`:" Gerade ist kein \xE4hnlich gutes Modell frei \u2013 LLMitMir wartet weiter."}
        ${H.kind!=="chat"?" Bisherige Schritte bleiben erhalten, es geht beim aktuellen Schritt weiter.":""}</div>
      <div class="row">
        ${M?t`<button class="btn primary" @click=${()=>this.switchModel(M.id)}>${d("retry",16)} Mit ${M.name} weitermachen</button>`:s}
        <button class="btn ghost" @click=${()=>this.hideHint=C.run_id+e.model}>Weiter warten</button>
      </div></div>`}switchModel(C){A.api.ws("chat/switch_model",{chat_id:this.chatId,model:C}).catch(H=>A.notify(String(H.message||H)))}permCards(){let C=(H,e)=>A.api.ws("permission/answer",{permission_id:H.id,decision:e});return A.permissions.filter(H=>H.chat_id===this.chatId).map(H=>H.steps?t`<div class="perm">
      <div class="row">${d("list")}<b class="grow">LLMitMir ist noch nicht fertig – weitere ${H.steps.more} Schritte verwenden?</b></div>
      <div class="hint">${H.steps.used} von ${H.steps.limit} Schritten sind verbraucht. Ohne weitere Schritte bringt LLMitMir in den letzten ${H.steps.limit-H.steps.used} Schritten Wichtiges zu Ende und schreibt dann den Bericht.${H.steps.lots?` Mit ${H.steps.lots} weiteren Schritten wird die Frage so schnell nicht wieder f\xE4llig.`:""}</div>
      <div class="row">
        <button class="btn primary" @click=${()=>C(H,"once")}>${d("check",16)} ${H.steps.more} weitere Schritte</button>
        ${H.steps.lots?t`<button class="btn" @click=${()=>C(H,"lots")}>${d("check",16)} ${H.steps.lots} weitere Schritte</button>`:s}
        <button class="btn ghost" @click=${()=>C(H,"deny")}>Zum Ende kommen</button>
      </div></div>`:H.change?t`<div class="perm">
      <div class="row">${d("edit")}<b class="grow">LLMitMir schlägt diese Änderung vor</b></div>
      ${g7(H.change)}
      <div class="row">
        <button class="btn primary ${H.change.aktion==="loeschen"?"danger":""}" @click=${()=>C(H,"once")}>${d("check",16)} ${H.change.aktion==="loeschen"?p("L\xF6schen"):p("\xDCbernehmen")}</button>
        <button class="btn ghost" @click=${()=>C(H,"deny")}>${p("Ablehnen")}</button>
        <button class="btn ghost" title=${p("Ohne diese \xC4nderung weiterarbeiten")} @click=${()=>C(H,"skip")}>${p("Ohne sie weitermachen")}</button>
      </div><div class="hint">Jede Änderung an Skills, Aufgaben und Zugängen fragt einzeln nach. Danach lässt sie sich jederzeit auf der Seite „${(z9[H.change.art]||[])[2]||""}“ anpassen.</div></div>`:H.group?t`<div class="perm">
      <div class="row">${d(H.icon||"lock")}<b class="grow">LLMitMir möchte „${H.group_label}“ nutzen: ${H.label}</b></div>
      <div class="hint">Diese Werkzeuge sind ${this.chat?.project_id?"in diesem Chat oder Projekt":"in diesem Chat"} nicht eingeschaltet.</div>
      <pre>${JSON.stringify(H.args||{},null,2)}</pre>
      <div class="row">
        <button class="btn primary" @click=${()=>C(H,"once")}>${p("Einmal erlauben")}</button>
        <button class="btn" @click=${()=>C(H,"always")}>${p("F\xFCr diesen Chat einschalten")}</button>
        <button class="btn ghost danger" @click=${()=>C(H,"deny")}>${p("Ablehnen")}</button>
        <button class="btn ghost" title=${p("Ohne dieses Werkzeug weiterarbeiten")} @click=${()=>C(H,"skip")}>${p("Ohne es weitermachen")}</button>
      </div><div class="hint">„Für diesen Chat einschalten“ gilt nur hier${this.chat?.kind==="chat"?" und l\xE4sst sich im Werkzeug-Men\xFC wieder abw\xE4hlen":""}; schreibende Aktionen fragen weiterhin nach.</div></div>`:t`<div class="perm">
      <div class="row">${d(H.icon||"lock")}<b class="grow">LLMitMir möchte: ${H.label}</b></div>
      <pre>${JSON.stringify(H.args||{},null,2)}</pre>
      <div class="row">
        <button class="btn primary" @click=${()=>A.api.ws("permission/answer",{permission_id:H.id,decision:"once"})}>${p("Einmal erlauben")}</button>
        <button class="btn" @click=${()=>A.api.ws("permission/answer",{permission_id:H.id,decision:"always"})}>${p("Immer erlauben")}</button>
        <button class="btn ghost danger" @click=${()=>A.api.ws("permission/answer",{permission_id:H.id,decision:"deny"})}>${p("Ablehnen")}</button>
        <button class="btn ghost" title=${p("Ohne diese Aktion weiterarbeiten")} @click=${()=>A.api.ws("permission/answer",{permission_id:H.id,decision:"skip"})}>${p("Ohne sie weitermachen")}</button>
      </div><div class="hint">„Immer erlauben“ gilt ${this.chat?.project_id?"f\xFCr dieses Projekt":"f\xFCr alle Chats ohne Projekt"} und lässt sich in den Einstellungen zurücknehmen.</div></div>`)}simpleThread(C,H){let e=[];for(let M of C.messages||[])(M.role==="user"||!e.length)&&e.push({user:M.role==="user"?M:null,rest:[]}),M.role!=="user"&&e[e.length-1].rest.push(M);let L=[],i="";return e.forEach((M,o)=>{let l=o===e.length-1,a=!!H&&l,m=nC((M.user||M.rest[0])?.created);m&&m!==i&&(L.push(t`<div class="day">${m}</div>`),i=m),M.user&&L.push(C.kind==="task_run"&&o===0?t`<div class="sys">${d("task",15)} Automatisch gestartet · ${i0(M.user.created)}</div>`:this.meBubble(M.user));let c=[...M.rest].reverse().filter(x=>x.role==="assistant"),u=x=>x&&(x.content||x.error)&&!x.tool_calls?.length,b=a?u(c[0])&&!F9(c[0])?c[0]:null:c.find(u)||c.find(x=>x.content);b&&L.push(this.aiBubble(b,a,l&&!H))}),L}meBubble(C){let H=C.content&&C.content!=="(siehe Anhang)"?C.content:"";return t`<div class="bubble me">
      ${C.attachments?.length?t`<div class="batt">${C.attachments.map(e=>t`<button @click=${()=>this.openFile(e)}>${d("file",15)}<span class="ellipsis">${e}</span></button>`)}</div>`:s}
      ${H?t`<div class="btxt">${H}</div>`:s}<span class="bt">${i0(C.created)}</span></div>`}aiBubble(C,H,e){return C.error?t`<div class="bubble ai fail">
      <div><b>Das hat leider nicht geklappt.</b> ${R9(C.error)}</div>
      ${R9(C.error)!==C.error?t`<details class="why"><summary>${d("info",15)} Was genau ist passiert?</summary><pre>${C.error}</pre></details>`:s}
      ${h7(this.chatId,C.offer,!0,e)}
      <div class="bfoot">${e?t`<button class="btn" @click=${()=>this.retry()}>${d("retry",16)} Noch einmal versuchen</button><span class="grow"></span>`:s}
        <span class="bt">${i0(C.created)}</span></div></div>`:t`<div class="bubble ai">
      <div class="md">${T1(C.content)}${H?t`<span class="caret"></span>`:s}</div>
      ${H?s:t`<div class="bfoot">
        <button class="mini" title=${p("Kopieren")} @click=${()=>A2(C.content)}>${d("copy",15)}</button>
        ${e?t`<button class="mini" title="Neue Antwort" @click=${()=>this.retry()}>${d("retry",15)}</button>`:s}
        <span class="bt">${i0(C.created)}</span></div>`}</div>`}typing(C,H){if(!C||C.status==="waiting_permission")return s;let e=H.messages[H.messages.length-1];if(e?.role==="assistant"&&(e.content||e.error)&&!e.tool_calls?.length&&!F9(e))return s;let L=this.now/1e3-(C.started||this.now/1e3),i=C.detail||{},M;if(C.status==="queued")M="Gleich geht's los \u2026";else if(C.status==="retry")M="Gerade ist viel los \u2013 gleich geht's weiter \u2026";else if(C.status==="quota_wait")M=`Tageslimit erreicht \u2013 weiter in ${x1(i.seconds)}`;else if(C.status==="tool")M=MC[i.tool?A.data?.tools?.[i.tool]?.group:i.model?"model":""]||"Arbeitet daran \u2026";else if(i.switched_from)M="Wechselt zu einer weniger ausgelasteten KI \u2026";else{let l=(i.step||1)>1?["Wertet aus","Denkt nach","Fasst zusammen"]:["Denkt nach","\xDCberlegt","Formuliert eine Antwort"];M=l[Math.floor(L/5)%l.length]+" \u2026"}let o=C.hint?"Die KI ist gerade sehr gefragt \u2013 das kann ein paar Minuten dauern.":L>45||C.status==="retry"?"Das dauert gerade etwas l\xE4nger.":"";return t`<div class="bubble ai typing" role="status" aria-live="polite">
        <lm-spark size="20"></lm-spark><span class="dots"><i></i><i></i><i></i></span><span class="tstat shimmer">${M}</span></div>
      ${o?t`<div class="slowsys">${o} Du kannst die Seite ruhig verlassen – die Antwort erscheint hier, sobald sie fertig ist.</div>`:s}`}simplePerms(){let C=(H,e)=>A.api.ws("permission/answer",{permission_id:H.id,decision:e});return A.permissions.filter(H=>H.chat_id===this.chatId).map(H=>{if(H.change){let e=H.change.aktion==="loeschen",L={anlegen:"anlegen",aendern:"\xE4ndern",loeschen:"l\xF6schen"}[H.change.aktion]||H.change.aktion;return t`<div class="bubble ai ask">
          <div>Soll ich ${oC[H.change.art]||H.change.art} <b>„${H.change.name}“</b> ${L}?</div>
          ${H.change.hinweis?t`<div class="hint">${d("alert",15)} ${H.change.hinweis}</div>`:s}
          <details class="why"><summary>${d("eye",15)} Genau ansehen</summary>${g7(H.change)}</details>
          <div class="brow"><button class="btn primary ${e?"danger":""}" @click=${()=>C(H,"once")}>${d("check",16)} Ja, ${e?"l\xF6schen":"\xFCbernehmen"}</button>
            <button class="btn" @click=${()=>C(H,"deny")}>Nein</button></div></div>`}return H.group?t`<div class="bubble ai ask">
        <div>Darf ich dafür <b>${aC[H.group]||H.group_label}</b> benutzen?</div>
        <details class="why"><summary>${d("eye",15)} Was genau?</summary><div class="hint" style="margin-bottom:6px">${H.label}</div><pre>${JSON.stringify(H.args||{},null,2)}</pre></details>
        <div class="brow"><button class="btn primary" @click=${()=>C(H,"once")}>${d("check",16)} Ja</button>
          <button class="btn" @click=${()=>C(H,"always")}>Ja, in diesem Chat immer</button>
          <button class="btn ghost" @click=${()=>C(H,"deny")}>Nein</button></div></div>`:t`<div class="bubble ai ask">
        <div>Darf ich das tun? <b>${H.label}</b></div>
        <details class="why"><summary>${d("eye",15)} Genau ansehen</summary><pre>${JSON.stringify(H.args||{},null,2)}</pre></details>
        <div class="brow"><button class="btn primary" @click=${()=>C(H,"once")}>${d("check",16)} Ja, diesmal</button>
          <button class="btn" @click=${()=>C(H,"always")}>Immer erlauben</button>
          <button class="btn ghost" @click=${()=>C(H,"deny")}>Nein</button></div>
        <div class="hint">„Immer erlauben“ lässt sich in den Einstellungen zurücknehmen.</div></div>`})}side(C){let H=A.chatFiles.get(C.id)||[],e=C.progress||[],L=!!A.runs[C.id]||C.status==="running",i=l=>l.status==="laeuft"&&!L?"erledigt":l.status,M=(A.data?.projects||[]).find(l=>l.id===C.project_id),o=C.usage||{};return t`<aside>
      ${this.narrow?t`<div class="row"><b class="grow">Details</b><button class="iconbtn" @click=${()=>this.panel=!1}>${d("close")}</button></div>`:s}
      <div><h3>${d("list",18)} ${p("Fortschritt")}</h3>
        ${e.length?t`<div class="prog">${e.map(l=>{let a=i(l);return t`<div>
          ${a==="erledigt"?t`<span class="ok">${d("check",18)}</span>`:a==="laeuft"?t`<span class="spin"></span>`:a==="fehler"?t`<span class="err">${d("alert",18)}</span>`:t`<span class="muted">${d("mdi:circle-outline",18)}</span>`}
          <span class=${a==="erledigt"?"done":""}>${l.text}</span></div>`})}</div>`:t`<div class="hint">Der Plan erscheint hier, sobald das Modell ihn anlegt.</div>`}</div>
      <div><h3>${d("file",18)} ${p("Dateien")}</h3>
        ${H.length?H.map(l=>t`<div class="fl" @click=${()=>this.openFile(l.name)}>${d("file",18)}<span class="grow ellipsis">${l.name}</span>
          <span class="muted" style="font-size:11.5px">${I(l.size)} B</span>${d("download",16)}</div>`):t`<div class="hint">Noch keine Dateien.</div>`}</div>
      <div><h3>${d("info",18)} Info</h3><div class="hint" style="display:grid;gap:4px">
        ${M?t`<span>${p("Projekte")}: <a href="#" @click=${l=>{l.preventDefault(),O(`/project/${M.id}`)}}>${M.name}</a></span>`:s}
        <span>${p("Modell")}: ${b1(C.model)}${C.model_auto?" (automatisch gew\xE4hlt)":""}</span>
        <span>Anfragen: ${o.requests||0} · Tokens: ${I((o.prompt||0)+(o.completion||0))}</span>
        <span>Erstellt: ${D(C.created)}</span></div></div>
    </aside>`}async rename(C){this.editTitle=!1,C.trim()&&C!==this.chat.title&&await A.api.ws("chat/update",{chat_id:this.chatId,title:C.trim()})}render(){let C=this.chat;if(!C)return t`<div class="main"><div class="empty"><lm-spark></lm-spark><p>${p("Laden \u2026")}</p></div></div>`;let H=A.runs[C.id],e=C.kind!=="chat",L=C.task_id?(A.data?.tasks||[]).find(l=>l.id===C.task_id):null,i=(A.data?.projects||[]).find(l=>l.id===C.project_id),M=E(),o=M?A.chatFiles.get(C.id)||[]:[];return t`<div class="main">
      <header>
        <slot name="menu"></slot>
        ${this.editTitle?t`<input .value=${C.title||""} @keydown=${l=>{l.key==="Enter"&&this.rename(l.target.value),l.key==="Escape"&&(this.editTitle=!1)}}
            @blur=${l=>this.rename(l.target.value)} autofocus>`:t`<span class="title ellipsis" @click=${()=>this.editTitle=!0}>${C.title||p("Neuer Chat")}</span>`}
        ${e&&!(M&&C.kind==="cowork")?t`<span class="chip accent">${d(C.kind==="task_run"?"task":"cowork",14)} ${C.kind==="task_run"?"Aufgabe":"Cowork"}</span>`:s}
        ${i&&!this.narrow?t`<span class="chip" style="cursor:pointer" @click=${()=>O(`/project/${i.id}`)}>${d("project",14)} ${i.name}</span>`:s}
        ${h1(C.model)?t`<span class="chip ext" title="Läuft kostenpflichtig bei ${T2(C.model)?.operator||"einem externen Anbieter"}">${d("euro",14)} ${M?"Ersatz-KI":"extern"}</span>`:s}
        <span class="grow"></span>
        ${o.length?t`<lm-menu direction="down" align="right"><button slot="trigger" class="btn ghost" title=${p("Dateien")}>${d("file",18)}${this.narrow?"":` ${p("Dateien")}`} <span class="chip">${o.length}</span></button>
          <div class="mh">Dateien in diesem Chat</div>
          ${o.map(l=>t`<button class="mi" data-close @click=${()=>this.openFile(l.name)}>${d("file",18)}<span class="grow ellipsis">${l.name}</span>${d("download",16)}</button>`)}</lm-menu>`:s}
        ${e&&this.narrow&&!M?t`<button class="iconbtn" @click=${()=>this.panel=!0} title="Details">${d("panel")}</button>`:s}
        <lm-menu direction="down" align="right"><button slot="trigger" class="iconbtn">${d("dots")}</button>
          <button class="mi" data-close @click=${()=>this.editTitle=!0}>${d("edit",18)} ${p("Umbenennen")}</button>
          <button class="mi" data-close @click=${()=>A.api.ws("chat/update",{chat_id:C.id,pinned:!C.pinned})}>${d(C.pinned?"pinOff":"pin",18)} ${C.pinned?p("L\xF6sen"):p("Anheften")}</button>
          <div class="mh">In Projekt verschieben</div>
          <button class="mi" data-close @click=${()=>A.api.ws("chat/update",{chat_id:C.id,project_id:null})}>${d("chat",18)} Ohne Projekt</button>
          ${(A.data?.projects||[]).map(l=>t`<button class="mi" data-close @click=${()=>A.api.ws("chat/update",{chat_id:C.id,project_id:l.id})}>${d("project",18)} ${l.name}</button>`)}
          <div class="msep"></div>
          <button class="mi" style="color:var(--lm-err)" data-close @click=${async()=>{await v1("Diesen Chat endg\xFCltig l\xF6schen?")&&(await A.api.ws("chat/delete",{chat_id:C.id}),O("/"))}}>${d("trash",18)} ${p("L\xF6schen")}</button>
        </lm-menu>
      </header>
      <div class="scroll" @scroll=${this.onScroll}><div class="thread ${M?"simple":""}">
        ${L?t`<div class="taskinfo">${d("task",18)}<span>${M?"Ergebnis":"Lauf"} der geplanten Aufgabe <a href="#" @click=${l=>{l.preventDefault(),O(`/task/${L.id}`)}}>${L.name}</a>.
          ${M?"Sie l\xE4uft von selbst nach Zeitplan.":"Open-Weight-Modelle k\xF6nnen verz\xF6gert starten und l\xE4nger laufen."}</span></div>`:s}
        ${C.messages.length===0&&!H?t`<div class="empty">${M?"Schreib einfach los \u2013 die Antwort erscheint hier.":e?"Beschreibe die Aufgabe \u2013 LLMitMir plant und arbeitet sie selbstst\xE4ndig ab.":"Schreib einfach los."}</div>`:s}
        ${M?this.simpleThread(C,H):this.renderMessages(C,H)}
        ${this.queuedBubbles(C)}
        ${M?this.simplePerms():this.permCards()}
        ${M?this.typing(H,C):this.runIndicator(H,C)}
      </div></div>
      <div class="foot">
        ${this.stick?s:t`<div class="jump"><button class="btn" @click=${()=>this.jumpDown()}>${d("arrowDown",16)} Nach unten</button></div>`}
        <lm-composer .simple=${M} .history=${C.messages.length>0} .mode=${C.kind==="chat"?"chat":"cowork"} .model=${C.model} .busy=${!!H} .chatUsage=${C.usage}
          .draftKey=${C.id}
          .tools=${C.tools??null} .projectId=${C.project_id}
          placeholder=${H?"Antwort l\xE4uft \u2013 du kannst schon weiterschreiben \u2026":p("Antworten \u2026")}
          @send=${this.send} @stop=${this.stop}></lm-composer>
        <div class="note">${h1(C.model)?`L\xE4uft kostenpflichtig bei ${T2(C.model)?.operator||"einem externen Anbieter"} \u2013 bitte keine sensiblen Daten eingeben.`:C.kind==="task_run"?"Antworten in diesem Lauf laufen als normaler Cowork weiter.":"KI kann Fehler machen. Wichtiges bitte pr\xFCfen."}</div>
      </div>
    </div>
    ${e&&!M&&!this.narrow?this.side(C):s}
    ${e&&!M&&this.narrow&&this.panel?t`<div class="sheet" @click=${l=>l.target===l.currentTarget&&(this.panel=!1)}>${this.side(C)}</div>`:s}`}};A1.styles=[j,$2,u5,B`
    :host { display: flex; height: 100%; min-height: 0; }
    .offer { display: grid; gap: 8px; font-size: 13.5px; margin-top: 4px; }
    .offer svg { vertical-align: -3px; color: var(--lm-warn); }
    .main { flex: 1; display: flex; flex-direction: column; min-width: 0; height: 100%; }
    /* Kein overflow: hidden in der Kopfzeile – sonst schneidet sie ihre eigenen
       Menüs ab, und die drei Punkte öffnen ein leeres Feld. Stattdessen schrumpfen
       Titel und Chips, damit nichts über die Fensterbreite hinausläuft. */
    header { display: flex; align-items: center; gap: 6px; padding: 8px 12px; min-height: 52px; }
    header > .chip { flex: 0 1 auto; min-width: 0; overflow: hidden; }
    header .title { flex: 0 1 auto; min-width: 0; font-weight: 560; font-size: 15px; padding: 6px 8px; border-radius: 8px; cursor: pointer; max-width: 60vw; }
    header .title:hover { background: var(--lm-hover); }
    header input { flex: 0 1 auto; min-width: 0; max-width: 420px; padding: 6px 8px; }
    /* Der Chat darf nie breiter als das Fenster werden: Raster mit minmax(0, 1fr) und
       min-width: 0 an den Kindern, damit breite Inhalte (Code, Tabellen) nur in ihrem
       eigenen Kasten scrollen und nicht den ganzen Verlauf auseinanderziehen. */
    .scroll { flex: 1; overflow-y: auto; overflow-x: hidden; overscroll-behavior: contain; }
    .thread { max-width: 780px; margin: 0 auto; padding: 10px 22px 30px; display: grid; grid-template-columns: minmax(0, 1fr); gap: 22px; }
    .thread > * { min-width: 0; }
    .user { justify-self: end; max-width: min(85%, 640px); background: var(--lm-user); border-radius: 18px 18px 6px 18px;
      padding: 10px 15px; white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.55; font-size: 15.5px; animation: fadeIn .25s; }
    /* Nachrichten, die waehrend eines Laufs geschrieben wurden: sichtbar, aber noch nicht dran */
    .queued { display: grid; gap: 10px; }
    .qrow { display: grid; gap: 4px; justify-items: end; }
    .qrow .user, .qrow .bubble { opacity: .62; }
    .qmeta { display: flex; align-items: center; gap: 5px; font-size: 12px; color: var(--lm-faint); padding-right: 4px; }
    .qmeta .iconbtn { padding: 2px; }
    .qmeta .btn.tiny { padding: 2px 9px; font-size: 12px; border-radius: 8px; }
    .att { display: flex; flex-wrap: wrap; gap: 6px; justify-content: flex-end; margin-bottom: 6px; }
    .att button { border: 1px solid var(--lm-line); background: var(--lm-raise); border-radius: 10px; padding: 4px 9px; font-size: 12.5px;
      cursor: pointer; display: inline-flex; gap: 5px; align-items: center; }
    .asst { display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px; animation: fadeIn .25s; }
    .asst > * { min-width: 0; }
    .meta { display: flex; align-items: center; gap: 2px; color: var(--lm-faint); font-size: 12px; opacity: 0; transition: opacity .2s; }
    .asst:hover .meta, .asst.last .meta { opacity: 1; }
    .meta .iconbtn { width: 30px; height: 30px; }
    .think { border-left: 2px solid var(--lm-line); padding: 2px 0 2px 12px; }
    .think summary { cursor: pointer; color: var(--lm-muted); font-size: 13px; list-style: none; display: flex; gap: 6px; align-items: center; }
    .think summary::-webkit-details-marker { display: none; }
    .think .txt { white-space: pre-wrap; overflow-wrap: anywhere; color: var(--lm-muted); font-size: 13.5px; line-height: 1.55; margin-top: 6px; max-height: 320px; overflow-y: auto; }
    .steps { border: 1px solid var(--lm-line); border-radius: 14px; overflow: hidden; background: var(--lm-panel); }
    .step { display: grid; gap: 2px; padding: 9px 12px; cursor: pointer; font-size: 13.5px; }
    .step + .step, .step + .detail, .detail + .step { border-top: 1px solid var(--lm-line); }
    .step:hover { background: var(--lm-hover); }
    .step .srow { display: flex; align-items: center; gap: 10px; min-width: 0; }
    .step .lbl { font-weight: 520; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .step .arg { color: var(--lm-muted); min-width: 0; }
    .step .st { margin-left: auto; display: flex; align-items: center; gap: 6px; color: var(--lm-faint); font-size: 12px; flex: none; }
    /* Kurze Vorschau auf den Befehl: höchstens zwei Zeilen, jede in einer Zeile gekürzt. */
    .step .prev { font-family: var(--lm-mono); font-size: 11.5px; line-height: 1.45; color: var(--lm-muted); padding-left: 28px; min-width: 0; }
    .step .prev div { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .ok { color: var(--lm-ok); } .err { color: var(--lm-err); } .den { color: var(--lm-warn); }
    .detail { padding: 10px 12px 12px 40px; font-size: 12.5px; background: var(--lm-side); }
    .detail pre { margin: 4px 0 8px; white-space: pre-wrap; word-break: break-word; font-family: var(--lm-mono); font-size: 12px;
      max-height: 280px; overflow-y: auto; background: var(--lm-panel); border: 1px solid var(--lm-line); padding: 8px; border-radius: 8px; }
    .perm.slow { border-color: color-mix(in srgb, var(--lm-warn) 45%, var(--lm-line)); }
    .perm.slow > .row:first-child svg { color: var(--lm-warn); }
    .running { display: flex; align-items: center; gap: 10px; color: var(--lm-muted); font-size: 14px; padding: 4px 0; }
    .runcmd { font-family: var(--lm-mono); font-size: 11.5px; color: var(--lm-faint); padding-left: 30px; margin-top: -4px;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .caret { display: inline-block; width: 8px; height: 1.05em; background: var(--lm-accent); border-radius: 2px; vertical-align: text-bottom;
      margin-left: 2px; animation: caret 1s steps(2) infinite; }
    @keyframes caret { 50% { opacity: 0; } }
    .error { border: 1px solid color-mix(in srgb, var(--lm-err) 40%, var(--lm-line)); background: color-mix(in srgb, var(--lm-err) 7%, var(--lm-panel));
      border-radius: 12px; padding: 12px 14px; display: flex; gap: 10px; align-items: flex-start; font-size: 14px; }
    .perm { border: 1px solid color-mix(in srgb, var(--lm-accent) 45%, var(--lm-line)); background: var(--lm-panel); border-radius: 16px;
      padding: 14px 16px; box-shadow: var(--lm-shadow); animation: fadeIn .25s; display: grid; gap: 10px; }
    .perm pre { margin: 0; font-family: var(--lm-mono); font-size: 12px; white-space: pre-wrap; word-break: break-word; max-height: 180px;
      overflow-y: auto; background: var(--lm-side); padding: 8px 10px; border-radius: 8px; }
    .perm .row { flex-wrap: wrap; }
    .chg { border: 1px solid var(--lm-line); border-radius: 12px; background: var(--lm-panel); overflow: hidden; cursor: auto; }
    .chg-h { display: flex; align-items: center; gap: 8px; padding: 9px 12px; border-bottom: 1px solid var(--lm-line); font-size: 14px; }
    .chg-h .chip { display: inline-flex; align-items: center; gap: 3px; }
    .badge { font-size: 11.5px; font-weight: 600; padding: 2px 9px; border-radius: 999px; text-transform: uppercase; letter-spacing: .03em; }
    .badge.add { background: color-mix(in srgb, var(--lm-ok) 15%, transparent); color: var(--lm-ok); }
    .badge.upd { background: var(--lm-accent-soft); color: var(--lm-accent); }
    .badge.del { background: color-mix(in srgb, var(--lm-err) 13%, transparent); color: var(--lm-err); }
    .chg.add { border-left: 3px solid var(--lm-ok); } .chg.upd { border-left: 3px solid var(--lm-accent); } .chg.del { border-left: 3px solid var(--lm-err); }
    .chg-note { display: flex; gap: 6px; align-items: center; padding: 8px 12px; font-size: 13px; color: var(--lm-warn);
      background: color-mix(in srgb, var(--lm-warn) 8%, transparent); border-bottom: 1px solid var(--lm-line); }
    .chg-f { display: grid; grid-template-columns: minmax(0, max-content) minmax(0, 1fr); gap: 9px 14px; padding: 11px 12px; font-size: 13.5px; align-items: baseline; }
    .chg-f .k { color: var(--lm-muted); font-size: 12.5px; }
    .chg-f .v { min-width: 0; overflow-wrap: anywhere; display: flex; flex-wrap: wrap; gap: 4px 6px; align-items: baseline; }
    .chg-f .v > .diff, .chg-f .v > .blk { flex: 1 1 100%; }
    .old { text-decoration: line-through; color: var(--lm-err); background: color-mix(in srgb, var(--lm-err) 9%, transparent); border-radius: 4px; padding: 0 5px; }
    .new { color: var(--lm-ok); background: color-mix(in srgb, var(--lm-ok) 11%, transparent); border-radius: 4px; padding: 0 5px; font-weight: 520; }
    .arrow { color: var(--lm-faint); } .gonetxt { text-decoration: line-through; color: var(--lm-muted); }
    .blk { white-space: pre-wrap; overflow-wrap: anywhere; font-size: 13px; line-height: 1.5; max-height: 240px; overflow-y: auto; background: var(--lm-side);
      border-radius: 8px; padding: 7px 10px; }
    .blk.add { border-left: 3px solid var(--lm-ok); } .blk.gone { border-left: 3px solid var(--lm-err); color: var(--lm-muted); text-decoration: line-through; }
    .diff { font-family: var(--lm-mono); font-size: 12px; line-height: 1.55; border: 1px solid var(--lm-line); border-radius: 8px; overflow-y: auto; max-height: 340px; }
    .diff > div { white-space: pre-wrap; word-break: break-word; padding: 1px 10px 1px 24px; position: relative; }
    .diff .a { background: color-mix(in srgb, var(--lm-ok) 13%, transparent); }
    .diff .a::before { content: "+"; position: absolute; left: 9px; color: var(--lm-ok); font-weight: 700; }
    .diff .d { background: color-mix(in srgb, var(--lm-err) 11%, transparent); }
    .diff .d::before { content: "−"; position: absolute; left: 9px; color: var(--lm-err); font-weight: 700; }
    .diff .c { color: var(--lm-muted); }
    .diff .s { color: var(--lm-faint); font-style: italic; background: var(--lm-side); padding-left: 10px; font-family: inherit; }
    .chgd { padding: 0 12px 12px 12px; background: var(--lm-panel); cursor: auto; }
    @media (max-width: 560px) { .chg-f { grid-template-columns: minmax(0, 1fr); gap: 2px 0; } .chg-f .v { margin-bottom: 8px; } }
    .foot { padding: 0 16px 14px; max-width: 812px; margin: 0 auto; width: 100%; position: relative; }
    .jump { position: absolute; top: -46px; left: 50%; transform: translateX(-50%); }
    .jump .btn { border-radius: 999px; background: var(--lm-panel); box-shadow: var(--lm-shadow); font-size: 13px; padding: 6px 14px; min-height: 32px; }
    .note { text-align: center; font-size: 11.5px; color: var(--lm-faint); margin-top: 6px; }
    aside { width: 320px; border-left: 1px solid var(--lm-line); background: var(--lm-bg); overflow-y: auto; padding: 14px; flex: none;
      display: grid; align-content: start; gap: 14px; }
    aside h3 { margin: 0 0 8px; font-size: 13px; font-weight: 600; display: flex; gap: 6px; align-items: center; }
    .prog { display: grid; gap: 6px; }
    .prog div { display: flex; gap: 8px; align-items: flex-start; font-size: 13.5px; line-height: 1.4; overflow-wrap: anywhere; }
    .prog .done { color: var(--lm-muted); text-decoration: line-through; text-decoration-color: var(--lm-faint); }
    .spin { width: 16px; height: 16px; border: 2px solid var(--lm-accent-soft); border-top-color: var(--lm-accent); border-radius: 50%;
      animation: rot .8s linear infinite; flex: none; margin-top: 1px; }
    @keyframes rot { to { transform: rotate(360deg); } }
    .fl { display: flex; align-items: center; gap: 8px; padding: 7px 8px; border-radius: 9px; cursor: pointer; font-size: 13px; }
    .fl:hover { background: var(--lm-hover); }
    .sheet { position: fixed; inset: 0; z-index: 20; background: rgba(0,0,0,.3); display: flex; justify-content: flex-end; animation: fadeIn .15s;
      padding-top: var(--safe-area-inset-top, 0px); padding-bottom: var(--safe-area-inset-bottom, 0px); }
    .sheet aside { width: min(360px, 88vw); height: 100%; border: 0; box-shadow: -10px 0 40px rgba(0,0,0,.2); background: var(--lm-bg); }
    .empty { text-align: center; color: var(--lm-muted); padding: 60px 20px; }
    /* simple view: messenger-style bubbles */
    :host { --lm-me: color-mix(in srgb, var(--lm-accent) 16%, var(--lm-panel)); }
    .thread.simple { gap: 8px; padding-top: 14px; }
    .day { justify-self: center; margin: 10px 0 4px; font-size: 12px; color: var(--lm-muted); background: var(--lm-panel);
      border: 1px solid var(--lm-line); padding: 3px 11px; border-radius: 999px; }
    .sys { justify-self: center; font-size: 12.5px; color: var(--lm-muted); background: var(--lm-hover); padding: 6px 12px; border-radius: 10px;
      text-align: center; max-width: 90%; display: flex; gap: 6px; align-items: center; }
    .bubble { max-width: min(84%, 640px); min-width: 0; padding: 8px 12px 5px; border-radius: 18px; line-height: 1.5; font-size: 15.5px;
      overflow-wrap: anywhere; animation: bin .22s ease both; }
    .bubble.me { justify-self: end; background: var(--lm-me); border-bottom-right-radius: 6px; }
    .bubble.ai { justify-self: start; background: var(--lm-panel); border: 1px solid var(--lm-line); border-bottom-left-radius: 6px;
      box-shadow: 0 1px 2px rgba(0,0,0,.04); }
    .bubble > * { min-width: 0; }
    .bubble .btxt { white-space: pre-wrap; overflow-wrap: anywhere; }
    .bubble .md { font-size: 15.5px; }
    .bubble .md > :last-child { margin-bottom: 0; }
    .bubble .md > :first-child { margin-top: 0; }
    .bfoot { display: flex; align-items: center; justify-content: flex-end; gap: 2px; margin-top: 2px; min-height: 18px; }
    .bt { font-size: 11px; color: var(--lm-faint); margin-left: 6px; white-space: nowrap; }
    .bubble.me .bt { display: block; text-align: right; margin-top: 1px; }
    .mini { border: 0; background: none; color: var(--lm-faint); width: 28px; height: 28px; border-radius: 8px; display: grid; place-items: center; cursor: pointer; }
    .mini:hover { background: var(--lm-hover); color: var(--lm-text); }
    .batt { display: flex; flex-wrap: wrap; gap: 6px; margin: 2px 0 6px; }
    .batt button { border: 0; background: color-mix(in srgb, var(--lm-panel) 70%, transparent); border-radius: 10px; padding: 6px 10px; font-size: 13px;
      cursor: pointer; display: inline-flex; gap: 6px; align-items: center; max-width: 100%; }
    .bubble.fail { border-color: color-mix(in srgb, var(--lm-err) 40%, var(--lm-line)); display: grid; gap: 8px; padding: 10px 14px 6px; }
    .bubble.ask { border-color: color-mix(in srgb, var(--lm-accent) 55%, var(--lm-line)); display: grid; gap: 10px; padding: 12px 14px;
      max-width: min(94%, 640px); box-shadow: var(--lm-shadow); }
    .brow { display: flex; flex-wrap: wrap; gap: 8px; }
    details.why > summary { cursor: pointer; font-size: 13px; color: var(--lm-muted); list-style: none; display: inline-flex; gap: 4px; align-items: center; }
    details.why > summary::-webkit-details-marker { display: none; }
    details.why[open] > summary { margin-bottom: 8px; }
    details.why pre { margin: 0; font-family: var(--lm-mono); font-size: 12px; white-space: pre-wrap; word-break: break-word; max-height: 200px;
      overflow-y: auto; background: var(--lm-side); padding: 8px 10px; border-radius: 8px; }
    .typing { display: inline-flex; align-items: center; gap: 10px; padding: 10px 16px 10px 12px; }
    .dots { display: inline-flex; gap: 4px; align-items: center; height: 14px; }
    .dots i { width: 7px; height: 7px; border-radius: 50%; background: var(--lm-accent); opacity: .35; animation: dot 1.3s ease-in-out infinite; }
    .dots i:nth-child(2) { animation-delay: .16s; } .dots i:nth-child(3) { animation-delay: .32s; }
    .tstat { font-size: 14px; }
    .slowsys { justify-self: start; max-width: min(84%, 560px); font-size: 13px; color: var(--lm-muted); padding: 0 6px; line-height: 1.45; animation: fadeIn .3s; }
    @keyframes dot { 0%, 60%, 100% { transform: translateY(0); opacity: .35; } 30% { transform: translateY(-5px); opacity: 1; } }
    @keyframes bin { from { opacity: 0; transform: translateY(6px) scale(.98); } }
    @media (prefers-reduced-motion: reduce) { .dots i, .bubble { animation: none; } .dots i { opacity: .7; } }
    .taskinfo { font-size: 13px; color: var(--lm-muted); background: var(--lm-side); border-radius: 12px; padding: 10px 12px; display: flex; gap: 8px; }
    @media (max-width: 640px) { .thread { padding: 8px 14px 24px; gap: 18px; } .foot { padding: 0 10px 10px; } header { padding: 6px 6px; } }
  `],h([T()],A1.prototype,"chatId",2),h([T({type:Boolean})],A1.prototype,"narrow",2),h([k()],A1.prototype,"openSteps",2),h([k()],A1.prototype,"panel",2),h([k()],A1.prototype,"editTitle",2),h([k()],A1.prototype,"now",2),h([k()],A1.prototype,"hideHint",2),h([k()],A1.prototype,"stick",2),h([D5(".scroll")],A1.prototype,"scroller",2),A1=h([F("lm-chat")],A1);var lC={tasks:{icon:"task",title:"LLMitMir erledigt etwas regelm\xE4\xDFig f\xFCr dich",text:"Eine geplante Aufgabe l\xE4uft von selbst zu festen Zeiten \u2013 auch wenn du gerade nicht hinschaust. Das Ergebnis bekommst du als Nachricht aufs Handy und findest es hier. Ist gerade viel los, startet eine Aufgabe auch mal ein paar Minuten sp\xE4ter.",examples:["Jeden Morgen um 7 Uhr: Wetter und Termine des Tages","Freitags: an die M\xFClltonne erinnern","Am Monatsersten: Stromverbrauch zusammenfassen"],steps:["Sag im Chat, was regelm\xE4\xDFig passieren soll und wann.","LLMitMir schl\xE4gt dir die fertige Aufgabe vor.","Du tippst auf \u201E\xDCbernehmen\u201C \u2013 fertig."],chat:["Aufgabe im Chat einrichten","Ich m\xF6chte eine geplante Aufgabe einrichten. Erkl\xE4re mir in einem Satz, was das ist, und frag mich dann Schritt f\xFCr Schritt, was regelm\xE4\xDFig passieren soll, wann und ob ich eine Nachricht aufs Handy bekommen m\xF6chte. Schlag mir am Ende die fertige Aufgabe vor."]},skills:{icon:"skill",title:"Anleitungen, die LLMitMir sich merkt",text:"Ein Skill ist wie ein Merkzettel f\xFCr ein wiederkehrendes Thema: Du erkl\xE4rst einmal, wie etwas geht. Kommt das Thema sp\xE4ter in einem Chat vor, liest LLMitMir die Anleitung von selbst nach \u2013 du musst sie nicht jedes Mal neu erkl\xE4ren.",examples:["So schreibe ich E-Mails an Kunden","Wo welche Unterlagen in der Nextcloud liegen","Wie unsere Heizung eingestellt wird"],steps:["Erz\xE4hl im Chat, worum es geht und was LLMitMir dabei beachten soll.","LLMitMir schreibt daraus die Anleitung.","Du tippst auf \u201E\xDCbernehmen\u201C."],chat:["Skill im Chat anlegen","Ich m\xF6chte einen neuen Skill anlegen. Erkl\xE4re mir in einem Satz, was ein Skill ist, und frag mich dann Schritt f\xFCr Schritt, worum es gehen soll und was du dabei beachten musst. Schlag mir am Ende den fertigen Skill vor."]},credentials:{icon:"key",title:"Passw\xF6rter sicher hinterlegen",text:"Damit LLMitMir zum Beispiel auf deine Nextcloud, einen Kalender oder einen anderen Dienst zugreifen kann, braucht es Benutzername und Passwort. Die tr\xE4gst du hier ein. Die KI selbst bekommt dein Passwort nie zu sehen \u2013 LLMitMir setzt es erst beim Zugriff im Hintergrund ein und schw\xE4rzt es in allen Ergebnissen.",examples:["Nextcloud (Dateien, Kalender, Kontakte)","Ein Webdienst mit Zugangsschl\xFCssel","Ein E-Mail-Postfach"],steps:["Tippe auf \u201ENeuer Zugang\u201C und w\xE4hle den Dienst.","Trag Adresse, Benutzername und Passwort ein.","Ab jetzt kann LLMitMir den Dienst nutzen, wenn du darum bittest."],chat:["Im Chat erkl\xE4ren lassen","Ich m\xF6chte einen neuen Zugang einrichten. Frag mich, f\xFCr welchen Dienst, und erkl\xE4re mir einfach, welche Angaben ich daf\xFCr brauche und wo ich sie finde. Das Passwort trage ich danach selbst ein."]},projects:{icon:"project",title:"Ordner f\xFCr alles, was zusammengeh\xF6rt",text:"Ein Projekt sammelt Chats, Dateien und Hinweise zu einem Thema. Was du im Projekt hinterlegst, kennt jeder neue Chat darin schon \u2013 du musst es nicht jedes Mal wieder erz\xE4hlen.",examples:["Hausbau \u2013 mit Pl\xE4nen und Budget","Steuern 2026 \u2013 mit Belegen","Verein \u2013 mit Satzung und Mitgliederliste"],steps:["Lege ein Projekt an und gib ihm einen Namen.","Schreib dazu, was LLMitMir wissen soll, und lade Dateien hoch.","Starte deine Chats direkt im Projekt."]}},x5=B`
  .explain { display: grid; gap: 12px; background: var(--lm-panel); border: 1px solid var(--lm-line); border-radius: 18px; padding: 18px 18px 16px;
    margin-bottom: 20px; box-shadow: var(--lm-shadow); }
  .explain .eh { display: flex; gap: 12px; align-items: center; }
  .explain .eh .ic { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 14px; background: var(--lm-accent-soft);
    color: var(--lm-accent); flex: none; }
  .explain .eh b { font-size: 17px; font-family: var(--lm-head); }
  .explain p { margin: 0; line-height: 1.55; font-size: 14.5px; }
  .explain .ex { display: flex; flex-wrap: wrap; gap: 6px; }
  .explain .ex span { font-size: 13px; background: var(--lm-hover); border-radius: 999px; padding: 4px 11px; color: var(--lm-muted); }
  .explain ol { margin: 0; padding: 0; list-style: none; display: grid; gap: 8px; counter-reset: s; }
  .explain li { display: flex; gap: 10px; align-items: flex-start; font-size: 14px; line-height: 1.45; counter-increment: s; }
  .explain li::before { content: counter(s); display: grid; place-items: center; width: 22px; height: 22px; border-radius: 50%; flex: none;
    background: var(--lm-accent); color: var(--lm-on-accent); font-size: 12px; font-weight: 650; margin-top: -1px; }
  .explain .eb { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 2px; }
  .explain.mini { padding: 12px 14px; gap: 0; }
  .explain.mini[open] { gap: 12px; }
  .explain.mini > summary { list-style: none; cursor: pointer; flex-wrap: wrap; }
  .explain.mini > summary::-webkit-details-marker { display: none; }
  .explain.mini > summary .grow { display: grid; gap: 1px; min-width: 180px; }
  .explain.mini > summary b { font-size: 15px; }
  .explain.mini .ic { width: 38px; height: 38px; border-radius: 12px; }
  details.more { margin-top: 14px; border: 1px solid var(--lm-line); border-radius: 14px; background: var(--lm-panel); }
  details.more > summary { cursor: pointer; padding: 12px 14px; font-weight: 560; font-size: 14px; list-style: none; display: flex; gap: 8px; align-items: center; }
  details.more > summary::-webkit-details-marker { display: none; }
  details.more[open] > summary { border-bottom: 1px solid var(--lm-line); }
  details.more > .in { padding: 14px; display: grid; gap: 14px; }
`;function E2(r,V){let C=lC[r],H=C.chat?t`<button class="btn ${V?"primary":""}" @click=${L=>{L.preventDefault(),dC(C.chat[1])}}>${d("chat",18)} ${C.chat[0]}</button>`:s,e=t`<p>${C.text}</p>
    <div><div class="hint" style="margin-bottom:6px">Zum Beispiel</div><div class="ex">${C.examples.map(L=>t`<span>${L}</span>`)}</div></div>
    <div><div class="hint" style="margin-bottom:8px">So geht's</div><ol>${C.steps.map(L=>t`<li>${L}</li>`)}</ol></div>`;return V?t`<div class="explain">
    <div class="eh"><span class="ic">${d(C.icon,24)}</span><b>${C.title}</b></div>
    ${e}${C.chat?t`<div class="eb">${H}</div>`:s}</div>`:t`<details class="explain mini"><summary class="eh"><span class="ic">${d(C.icon,22)}</span>
      <span class="grow"><b>${C.title}</b><span class="hint">So funktioniert's</span></span>${H}</summary>${e}</details>`}async function dC(r){try{await M0({text:r,files:[],model:"",mode:"chat",tools:null,project_id:null})}catch(V){A.notify(String(V.message||V))}}var R2=(r,V="Mehr Optionen")=>t`<details class="more"><summary>${d("settings",18)} ${V}</summary><div class="in">${r}</div></details>`;var AC=480,pC=88,P1=null;function mC(){try{let r=window.AudioContext||window.webkitAudioContext;if(!r)return;P1=P1||new r,P1.state==="suspended"&&P1.resume().catch(()=>{});let V=P1.currentTime,C=(H,e,L,i)=>{let M=P1.createOscillator(),o=P1.createGain();M.type="sine",M.frequency.value=H,o.gain.setValueAtTime(0,V+e),o.gain.linearRampToValueAtTime(i,V+e+.012),o.gain.exponentialRampToValueAtTime(1e-4,V+e+L),M.connect(o).connect(P1.destination),M.start(V+e),M.stop(V+e+L+.02)};C(880,0,.13,.16),C(1320,.11,.16,.12)}catch{}}var p2=class extends e1{constructor(){super(...arguments);this.menu=null;this.drag=null;this.timer=null;this.press=null;this.pressTimer=null;this.lastPing=0;this.seen=new Set;this.wake=()=>{P1?.state==="suspended"&&P1.resume().catch(()=>{})}}connectedCallback(){super.connectedCallback(),this.lastPing=A.inboxPing||0;for(let C of A.inbox||[])this.seen.add(C.id);this.timer=setInterval(()=>this.requestUpdate(),2e4),window.addEventListener("pointerdown",this.wake,{passive:!0})}disconnectedCallback(){super.disconnectedCallback(),clearInterval(this.timer),clearTimeout(this.pressTimer),window.removeEventListener("pointerdown",this.wake)}updated(){let C=A.inboxPing||0;C&&C!==this.lastPing&&(this.lastPing=C,A.inbox.filter(e=>!this.seen.has(e.id)).length&&document.visibilityState==="visible"&&mC());for(let H of A.inbox||[])this.seen.add(H.id)}items(){let C=Number(A.data?.settings?.inbox_minutes??30),H=Date.now()/1e3;return(A.inbox||[]).filter(e=>!C||H-Number(e.at||0)<=C*60)}async dismiss(C){this.renderRoot.querySelector(`[data-id="${C.id}"]`)?.classList.add("gone"),setTimeout(async()=>{try{await A.api.ws("inbox/dismiss",{entry_id:C.id})}catch(e){A.notify(e.message||p("Konnte nicht entfernt werden")),await A.load()}},160)}async muteChat(C){this.menu=null;try{await A.api.ws("inbox/mute",{chat_id:C.chat_id,mute:!0}),A.notify(p("Benachrichtigungen f\xFCr diesen Chat aus"))}catch(H){A.notify(H.message)}}open(C){this.menu=null,A.api.ws("inbox/dismiss",{entry_id:C.id}).catch(()=>{}),O(`/chat/${C.chat_id}`)}down(C,H){if(!C.target.closest(".x")){try{C.currentTarget.setPointerCapture(C.pointerId)}catch{}this.press={x:C.clientX,y:C.clientY,id:H.id,item:H,moved:!1,long:!1},clearTimeout(this.pressTimer),this.pressTimer=setTimeout(()=>{if(!(!this.press||this.press.moved)){this.press.long=!0,this.menu=H;try{navigator.vibrate?.(12)}catch{}}},AC)}}move(C){let H=this.press;if(!H)return;let e=C.clientX-H.x,L=C.clientY-H.y;(Math.abs(e)>6||Math.abs(L)>6)&&(H.moved=!0),Math.abs(e)>Math.abs(L)&&e<0&&(clearTimeout(this.pressTimer),this.drag={id:H.id,dx:Math.max(e,-160)})}up(C){let H=this.press;if(this.press=null,!H)return;clearTimeout(this.pressTimer);let e=this.drag?.id===H.id?this.drag.dx:0;if(this.drag=null,e<=-pC){this.dismiss(H.item);return}if(H.long||H.moved){this.requestUpdate();return}this.open(H.item)}render(){let C=this.items();return C.length?t`
      <div class="stack" role="log" aria-live="polite">
        ${C.map(H=>t`
          <div class="card-n ${H.status&&H.status!=="done"?"warn":""}" data-id=${H.id} role="button" tabindex="0"
            aria-label=${`${H.task||p("Geplante Aufgabe")}: ${H.title||""}`}
            style=${this.drag?.id===H.id?`transform: translateX(${this.drag.dx}px)`:""}
            @pointerdown=${e=>this.down(e,H)}
            @pointermove=${e=>this.move(e)}
            @pointerup=${e=>this.up(e)}
            @pointercancel=${()=>{this.press=null,this.drag=null}}
            @keydown=${e=>{(e.key==="Enter"||e.key===" ")&&(e.preventDefault(),this.open(H))}}
            @contextmenu=${e=>e.preventDefault()}>
            <span class="ic">${d(H.status&&H.status!=="done"?"alert":"bell",17)}</span>
            <div class="body">
              <div class="top"><span class="app">${H.task||p("Geplante Aufgabe")}</span><span class="when">${D(H.at)}</span></div>
              <div class="head">${H.title||p("Fertig")}</div>
              <div class="txt">${H.text||""}</div>
            </div>
            <button class="x" title=${p("Entfernen")} @click=${e=>{e.stopPropagation(),this.dismiss(H)}}>${d("close",15)}</button>
          </div>`)}
      </div>
      ${C.length>1?t`<div class="more"><button @click=${()=>this.clearAll()}>
        ${p("Alle {n} entfernen",{n:C.length})}</button></div>`:s}
      ${this.menu?t`<div class="sheet" @click=${()=>this.menu=null}>
        <div class="box" @click=${H=>H.stopPropagation()}>
          <div class="ttl">${this.menu.task||p("Geplante Aufgabe")}</div>
          <button @click=${()=>this.open(this.menu)}>${d("chat",18)} ${p("Chat \xF6ffnen")}</button>
          <button class="danger" @click=${()=>this.muteChat(this.menu)}>${d("bellOff",18)} ${p("Benachrichtigungen dieses Chats ausschalten")}</button>
          <button @click=${()=>{let H=this.menu;this.menu=null,this.dismiss(H)}}>${d("close",18)} ${p("Nur diese entfernen")}</button>
        </div>
      </div>`:s}`:s}async clearAll(){try{await A.api.ws("inbox/clear")}catch(C){A.notify(C.message)}}};p2.styles=[j,B`
    :host { display: block; }
    .stack { display: flex; flex-direction: column; gap: 8px; margin: 0 0 18px; }
    .card-n { position: relative; display: flex; gap: 11px; align-items: flex-start; padding: 11px 12px 12px;
      border: 1px solid var(--lm-line); border-radius: 16px; background: var(--lm-panel); box-shadow: var(--lm-shadow);
      cursor: pointer; overflow: hidden; touch-action: pan-y; user-select: none; -webkit-user-select: none;
      animation: drop .28s cubic-bezier(.2,.9,.3,1.1); transition: transform .18s ease, opacity .18s ease; }
    .card-n:active { background: var(--lm-raise); }
    .card-n.gone { transform: translateX(-110%); opacity: 0; }
    .card-n .ic { flex: none; width: 30px; height: 30px; border-radius: 9px; display: grid; place-items: center;
      background: var(--lm-accent-soft); color: var(--lm-accent); margin-top: 1px; }
    .card-n .body { flex: 1; min-width: 0; }
    .card-n .top { display: flex; align-items: baseline; gap: 8px; }
    .card-n .app { font-size: 11.5px; letter-spacing: .02em; text-transform: uppercase; color: var(--lm-muted);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .card-n .when { margin-left: auto; font-size: 11.5px; color: var(--lm-faint); flex: none; }
    .card-n .head { font-weight: 600; font-size: 14px; margin: 2px 0 1px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .card-n .txt { font-size: 13px; color: var(--lm-muted); line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 3;
      -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere; }
    .card-n .x { flex: none; width: 26px; height: 26px; border: 0; background: none; color: var(--lm-faint); border-radius: 50%;
      cursor: pointer; display: grid; place-items: center; margin: -2px -4px 0 0; }
    .card-n .x:hover { background: var(--lm-hover); color: var(--lm-text); }
    .card-n.warn .ic { background: color-mix(in srgb, #d98324 22%, transparent); color: #d98324; }
    .more { display: flex; justify-content: center; margin: -8px 0 16px; }
    .more button { border: 0; background: none; color: var(--lm-muted); font-size: 12.5px; cursor: pointer; padding: 4px 8px; border-radius: 8px; }
    .more button:hover { background: var(--lm-hover); color: var(--lm-text); }
    .sheet { position: fixed; inset: 0; z-index: 60; background: rgba(0,0,0,.35); display: flex; align-items: flex-end;
      justify-content: center; animation: fadeIn .15s; }
    .sheet .box { width: min(460px, 100%); background: var(--lm-panel); border: 1px solid var(--lm-line);
      border-radius: 18px 18px 0 0; padding: 8px; box-shadow: var(--lm-shadow); animation: up .2s ease; }
    .sheet .ttl { padding: 10px 12px 6px; font-size: 12.5px; color: var(--lm-muted); }
    .sheet button { display: flex; align-items: center; gap: 10px; width: 100%; border: 0; background: none; color: var(--lm-text);
      padding: 13px 12px; border-radius: 12px; font-size: 14.5px; cursor: pointer; text-align: left; }
    .sheet button:hover { background: var(--lm-hover); }
    .sheet button.danger { color: #d9534f; }
    @keyframes drop { from { opacity: 0; transform: translateY(-10px) scale(.98); } to { opacity: 1; transform: none; } }
    @keyframes up { from { transform: translateY(18px); opacity: .6; } to { transform: none; opacity: 1; } }
    @media (prefers-reduced-motion: reduce) { .card-n, .sheet, .sheet .box { animation: none; } }
  `],h([k()],p2.prototype,"menu",2),h([k()],p2.prototype,"drag",2),p2=h([F("lm-inbox")],p2);async function M0(r){let V=r.mode==="cowork"?"cowork":"chat",C=await A.api.ws("chat/create",{kind:V,project_id:r.project_id,model:r.model,...V==="chat"?{tools:r.tools}:{}}),H=[];r.files.length&&(H=(await A.api.upload("chat",C.id,r.files)).files.map(e=>e.name)),A.chats.set(C.id,{...C,messages:[],progress:[],usage:{}}),O(`/chat/${C.id}`),await A.api.ws("chat/send",{chat_id:C.id,text:r.text||"(siehe Anhang)",attachments:H,model:r.model})}function cC(){let r=new Date().getHours();return r<5?p("Gute Nacht"):r<11?p("Guten Morgen"):r<18?p("Guten Tag"):p("Guten Abend")}var B1=class extends e1{constructor(){super(...arguments);this.initialMode="chat";this.projectId=null;this.mode="chat";this.model="";this.busy=!1;this.manual=!1}connectedCallback(){super.connectedCallback(),this.mode=this.initialMode,this.pickModel()}updated(C){C.has("initialMode")&&(this.mode=this.initialMode,this.manual=!1,this.pickModel())}willUpdate(){this.manual||this.pickModel()}pickModel(){let C=A.data?.defaults||{},H=(A.data?.projects||[]).find(e=>e.id===this.projectId);this.model=(this.mode==="chat"?H?.model_chat||C.chat:H?.model_agent||C.agent)||""}async send(C){if(!this.busy){this.busy=!0;try{await M0(C.detail)}catch(H){A.notify(String(H.message||H))}this.busy=!1}}fill(C,H){this.mode=H,this.manual=!1,this.pickModel();let e=this.renderRoot.querySelector("lm-composer");e?.setText(C),e?.focus()}render(){let C=A.data,H=(C?.user?.name||"").split(" ")[0],e=C?.usage,L=E(),i=L?"chat":this.mode;return t`<div class="wrap">
      ${e&&!e.has_key?t`<div class="card nokey row">${d("key")}<div class="grow">${C.key_mode==="per_user_own"?t`Trag zuerst deinen API-Schlüssel ein.`:t`Es ist noch kein API-Schlüssel hinterlegt. ${C.user.is_admin?"Lege ihn unter Admin fest.":"Bitte den Admin, einen einzutragen."}`}</div>
        <button class="btn" @click=${()=>O(C.key_mode==="per_user_own"?"/settings":"/admin")}>Öffnen</button></div>`:s}
      <lm-inbox></lm-inbox>
      <h1><lm-spark size="34" .active=${!1}></lm-spark>${cC()}${H?`, ${H}`:""}</h1>
      <lm-composer big ?showMode=${!L} ?showProject=${!L} .simple=${L} .mode=${i} .model=${this.model} .projectId=${this.projectId} .busy=${this.busy}
        .draftKey=${this.projectId?Z7(this.projectId):E9}
        placeholder=${i==="cowork"?p("Was soll ich erledigen?"):p("Wie kann ich helfen?")}
        @mode=${M=>{this.mode=M.detail,this.manual=!1}} @model=${M=>{this.model=M.detail,this.manual=!0}}
        @project=${M=>{this.projectId=M.detail,this.manual=!1,this.pickModel()}} @send=${this.send}></lm-composer>
      <div class="sugg">
        ${L?t`
          <button @click=${()=>this.fill("Erkl\xE4re mir einfach und verst\xE4ndlich: ","chat")}>${d("sparkle",16)} Etwas erklären lassen</button>
          <button @click=${()=>this.fill(`Verbessere diesen Text, freundlich und gut verst\xE4ndlich:

`,"chat")}>${d("edit",16)} Text verbessern</button>
          <button @click=${()=>this.fill("Suche im Internet nach ","chat")}>${d("web",16)} Im Internet suchen</button>
          <button @click=${()=>this.fill("Wie ist es gerade zu Hause? Ist alles in Ordnung?","chat")}>${d("home",16)} Alles ok zu Hause?</button>
          <button @click=${()=>this.fill("Erinnere mich jeden Tag um 8 Uhr an ","chat")}>${d("task",16)} Regelmäßig erinnern</button>
          <button @click=${()=>this.fill("Was kannst du alles f\xFCr mich tun? Erkl\xE4re es mir einfach, mit ein paar Beispielen.","chat")}>${d("info",16)} Was kannst du?</button>`:this.mode==="chat"?t`
          <button @click=${()=>this.fill("Erkl\xE4re mir verst\xE4ndlich: ","chat")}>${d("sparkle",16)} Erklären</button>
          <button @click=${()=>this.fill(`Formuliere diese E-Mail freundlich und knapp um:

`,"chat")}>${d("edit",16)} Text überarbeiten</button>
          <button @click=${()=>this.fill("Suche im Web nach ","chat")}>${d("web",16)} Im Web suchen</button>`:t`
          <button @click=${()=>this.fill("Wie ist der Zustand im Haus? Pr\xFCfe Heizung, offene Fenster und auff\xE4llige Sensoren und fasse zusammen.","cowork")}>${d("home",16)} Hausstatus</button>
          <button @click=${()=>this.fill("Lies die Dateien im Ordner \u2026 meines Zugangs \u2026 und erstelle eine \xDCbersicht als Tabelle.","cowork")}>${d("cloud",16)} Dateien auswerten</button>
          <button @click=${()=>this.fill("Recherchiere zu \u2026 und schreibe eine kurze Zusammenfassung mit Quellen in eine Datei.","cowork")}>${d("search",16)} Recherche</button>`}
      </div>
      <div class="info">${L?"KI kann Fehler machen \u2013 Wichtiges bitte pr\xFCfen. Antworten k\xF6nnen je nach Auslastung etwas dauern.":`${C?.provider?.name||""} \xB7 Open-Weight-Modelle \u2013 Antworten k\xF6nnen je nach Auslastung dauern.`}</div>
    </div>`}};B1.styles=[j,B`
    :host { display: block; height: 100%; overflow-y: auto; }
    .wrap { min-height: 100%; display: flex; flex-direction: column; justify-content: center; max-width: 760px; margin: 0 auto; padding: 24px 20px 12vh; }
    h1 { font-family: var(--lm-head); font-weight: 600; font-size: clamp(26px, 4vw, 38px); text-align: center; margin: 0 0 26px;
      display: flex; align-items: center; justify-content: center; gap: 14px; letter-spacing: -.015em; animation: fadeIn .5s; }
    .sugg { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-top: 16px; }
    .sugg button { border: 1px solid var(--lm-line); background: transparent; border-radius: 999px; padding: 7px 13px; font-size: 13.5px;
      color: var(--lm-muted); cursor: pointer; display: inline-flex; gap: 6px; align-items: center; transition: all .15s; }
    .sugg button:hover { background: var(--lm-panel); color: var(--lm-text); border-color: color-mix(in srgb, var(--lm-accent) 40%, var(--lm-line)); }
    .info { margin-top: 26px; font-size: 12.5px; color: var(--lm-faint); text-align: center; }
    .nokey { margin-bottom: 16px; }
  `],h([T()],B1.prototype,"initialMode",2),h([T()],B1.prototype,"projectId",2),h([k()],B1.prototype,"mode",2),h([k()],B1.prototype,"model",2),h([k()],B1.prototype,"busy",2),B1=h([F("lm-home")],B1);var m2=class extends e1{constructor(){super(...arguments);this.q="";this.filter="all"}render(){let C=(A.data?.chats||[]).filter(e=>(this.filter==="all"||e.kind===this.filter)&&(!this.q||(e.title||"").toLowerCase().includes(this.q.toLowerCase()))),H=e=>(A.data?.projects||[]).find(L=>L.id===e)?.name;return t`<div class="page"><h1>${p("Chats")}</h1>
      <input placeholder=${p("Suchen \u2026")} .value=${this.q} @input=${e=>this.q=e.target.value}>
      <div class="tabs">${(E()?[["all",p("Alle")],["task_run","Ergebnisse geplanter Aufgaben"]]:[["all",p("Alle")],["chat","Chats"],["cowork","Coworks"],["task_run",p("Aufgabenl\xE4ufe")]]).map(([e,L])=>t`<button class=${this.filter===e?"on":""} @click=${()=>this.filter=e}>${L}</button>`)}</div>
      <div class="list">${C.length?C.map(e=>t`<div class="item" @click=${()=>O(`/chat/${e.id}`)}>
        ${d(e.kind==="chat"?"chat":e.kind==="cowork"?"cowork":"task")}
        <div class="grow"><div class="ellipsis">${e.title||p("Neuer Chat")}</div>
          <div class="hint">${D(e.updated)} · ${e.messages} Nachrichten${e.project_id?` \xB7 ${H(e.project_id)||""}`:""}</div></div>
        ${e.status==="running"?t`<lm-spark size="18"></lm-spark>`:e.status==="error"?t`<span class="chip err">Fehler</span>`:s}
        ${e.pinned?d("pin",16):s}</div>`):t`<div class="hint">${p("Keine Chats")}</div>`}</div></div>`}};m2.styles=[j,B`:host { display: block; height: 100%; overflow-y: auto; }
    .tabs { display: flex; gap: 6px; flex-wrap: wrap; margin: 10px 0 16px; }
    .tabs button { border: 1px solid var(--lm-line); background: none; border-radius: 999px; padding: 6px 12px; cursor: pointer; font-size: 13px; }
    .tabs button.on { background: var(--lm-text); color: var(--lm-bg); border-color: var(--lm-text); }`],h([k()],m2.prototype,"q",2),h([k()],m2.prototype,"filter",2),m2=h([F("lm-chats")],m2);var h5=class extends e1{create(){O("/project/new")}render(){let V=A.data?.projects||[],C=H=>(A.data?.chats||[]).filter(e=>e.project_id===H).length;return t`<div class="page"><div class="row"><h1 class="grow">${p("Projekte")}</h1>
      <button class="btn primary" @click=${this.create}>${d("plus",18)} ${p("Neues Projekt")}</button></div>
      ${E()?E2("projects",!V.length):t`<p class="hint">Projekte bündeln Anweisungen, Dateien, Zugänge und Skills. Chats und Coworks darin starten mit diesem Kontext.</p>`}
      <div class="grid">${V.map(H=>t`<div class="item pc" @click=${()=>O(`/project/${H.id}`)}>
        <div class="row">${d("project")}<b class="grow ellipsis">${H.name}</b></div>
        <div class="hint" style="display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden">${H.description||(H.instructions||"").slice(0,160)||"Noch keine Anweisungen."}</div>
        <div class="row" style="margin-top:auto"><span class="chip">${C(H.id)} Chats</span>
          ${Number(H.retention_days)>0?t`<span class="chip" title="Chats und Coworks dieses Projekts werden danach gelöscht">${d("hourglass",13)} ${A5(H.retention_days)}</span>`:s}${(H.credentials||[]).length?t`<span class="chip">${d("key",13)} ${(H.credentials||[]).length}</span>`:s}
          ${(H.skills||[]).length?t`<span class="chip">${d("skill",13)} ${(H.skills||[]).length}</span>`:s}</div></div>`)}
        <div class="item pc new" @click=${this.create}>${d("plus")} ${p("Neues Projekt")}</div></div></div>`}};h5.styles=[j,x5,B`:host { display: block; height: 100%; overflow-y: auto; }
    .pc { padding: 16px; min-height: 120px; display: grid; align-content: start; gap: 6px; }
    .pc b { font-size: 15px; }
    .item.pc.new { display: flex; flex-direction: row; align-items: center; justify-content: center; gap: 8px; border-style: dashed; color: var(--lm-muted); }`],h5=h([F("lm-projects")],h5);var I1=class extends e1{constructor(){super(...arguments);this.projectId="";this.draft=null;this.files=[];this.dirty=!1}updated(C){C.has("projectId")&&this.reload()}async reload(){if(this.projectId==="new"){this.draft={name:"",description:"",instructions:"",credentials:[],skills:[],retention_days:A.data?.retention?.default??0},this.dirty=!1,this.files=[],this.updateComplete.then(()=>this.renderRoot.querySelector("input.title")?.focus());return}let C=(A.data?.projects||[]).find(H=>H.id===this.projectId);this.draft=C?JSON.parse(JSON.stringify(C)):null,this.dirty=!1,C&&(this.files=await A.api.ws("files",{scope:"project",owner:C.id}))}set(C,H){this.draft={...this.draft,[C]:H},this.dirty=!0}toggle(C,H){let e=new Set(this.draft[C]||[]);e.has(H)?e.delete(H):e.add(H),this.set(C,[...e])}async save(){if(!String(this.draft.name||"").trim()){A.notify("Bitte gib dem Projekt einen Namen.");return}try{let C=await A.api.ws("project/save",{project:this.draft});this.dirty=!1,A.notify(p("Gespeichert")),await A.load(),this.projectId==="new"&&O(`/project/${C.id}`,!0)}catch(C){A.notify(C.message)}}async upload(C){try{await A.api.upload("project",this.projectId,C.target.files),this.files=await A.api.ws("files",{scope:"project",owner:this.projectId})}catch(H){A.notify(H.message)}C.target.value=""}render(){let C=this.draft;if(!C)return t`<div class="page hint">Projekt nicht gefunden.</div>`;let H=A.data,e=(H.chats||[]).filter(u=>u.project_id===C.id),L=H.models||[],i=H.tool_groups||{},M=Object.entries(H.tools||{}).filter(([,u])=>u.write&&!u.confirm),o=E(),l=Number(C.retention_days??H.retention?.default??0)||0,a=o?"Was soll LLMitMir in diesem Projekt immer wissen?":p("Anweisungen"),m=o?"Zum Beispiel: Worum es geht, wer beteiligt ist, was wichtig ist und wie Antworten aussehen sollen.":"Was soll das Modell in diesem Projekt immer wissen und beachten? (Rolle, Ziele, Regeln, Formate \u2026)",c=u=>o?R2(u,"Mehr Optionen: Zug\xE4nge, Skills, Freigaben"):u;return t`<div class="page">
      <div class="row"><button class="iconbtn" @click=${()=>O("/projects")}>${d("left")}</button>
        <label class="tw"><input class="title" placeholder="Name des Projekts" aria-label="Name des Projekts" .value=${C.name}
          @input=${u=>this.set("name",u.target.value)}><span class="pen">${d("edit",18)}</span></label></div>
      <input style="margin:4px 0 18px" placeholder="Kurzbeschreibung" .value=${C.description||""} @input=${u=>this.set("description",u.target.value)}>
      ${C.id?t`
      <div class="cols"><div>
        <lm-composer ?showMode=${!o} .simple=${o} .projectId=${C.id} .mode=${"chat"} .model=${C.model_chat||H.defaults.chat}
          .draftKey=${Z7(C.id)} placeholder="Neuer Chat in diesem Projekt …"
          @send=${async u=>{try{await M0({...u.detail,project_id:C.id})}catch(b){A.notify(b.message)}}}></lm-composer>
        <h2>Chats & Coworks</h2>
        <div class="list">${e.length?e.map(u=>t`<div class="item" @click=${()=>O(`/chat/${u.id}`)}>
          ${d(u.kind==="chat"?"chat":u.kind==="cowork"?"cowork":"task")}<div class="grow ellipsis">${u.title}</div><span class="hint">${D(u.updated)}</span></div>`):t`<div class="hint">Noch keine Chats in diesem Projekt.</div>`}</div>
        <h2>${a}</h2>
        <textarea rows="12" placeholder=${m}
          .value=${C.instructions||""} @input=${u=>this.set("instructions",u.target.value)}></textarea>
      </div>
      <div class="side">
        <div class="card"><h3>${d("file",18)} ${p("Dateien")}</h3>
          ${this.files.map(u=>t`<div class="row" style="padding:4px 0"><span class="grow ellipsis" style="font-size:13px">${u.name}</span>
            <button class="iconbtn" @click=${async()=>window.open(await A.api.fileUrl("project",C.id,u.name),"_blank")}>${d("download",16)}</button>
            <button class="iconbtn" @click=${async()=>{this.files=await A.api.ws("file/delete",{scope:"project",owner:C.id,name:u.name})}}>${d("trash",16)}</button></div>`)}
          <label class="btn" style="margin-top:6px">${d("upload",16)} Hochladen<input type="file" multiple hidden @change=${this.upload}></label>
          <div class="hint" style="margin-top:6px">${o?"LLMitMir schaut in diese Dateien, wenn sie f\xFCr eine Frage wichtig sind.":"Das Modell liest sie bei Bedarf mit \u201EDatei lesen\u201C (Bereich Projekt)."}</div></div>
        <div class="card"><h3>${d("hourglass",18)} Lebensdauer</h3>
          <label class="row hint" style="align-items:center"><input type="checkbox" style="width:auto" .checked=${l>0}
            @change=${u=>this.set("retention_days",u.target.checked?H.retention?.suggest||30:0)}>
            Chats und Coworks dieses Projekts automatisch löschen</label>
          ${l>0?t`<label class="f" style="margin-top:8px"><span>… nach so vielen Tagen</span>
            <input type="number" min="1" max=${H.retention?.max||3650} .value=${String(l)}
              @change=${u=>this.set("retention_days",Math.max(1,Number(u.target.value)||1))}></label>`:s}
          <div class="hint" style="margin-top:6px">${l>0?`Derzeit: ${A5(l)} ab der letzten Benutzung; danach wird der Chat samt Anh\xE4ngen, Arbeitsbereich und Sandbox restlos gel\xF6scht.`:"Aus \u2013 die Chats und Coworks dieses Projekts bleiben, bis du sie selbst l\xF6schst."}
            Angeheftete Chats und die Läufe geplanter Aufgaben bleiben.</div></div>
        ${c(t`<div class="card"><h3>${d("key",18)} ${p("Zug\xE4nge")}</h3><div class="chips">
          ${(H.credentials||[]).map(u=>t`<button class=${(C.credentials||[]).includes(u.id)?"on":""} @click=${()=>this.toggle("credentials",u.id)}>${u.name}</button>`)}
          ${(H.credentials||[]).length?s:t`<span class="hint">Noch keine Zugänge angelegt.</span>`}</div>
          <label class="row hint" style="margin-top:8px"><input type="checkbox" style="width:auto" .checked=${!!C.credentials_only} @change=${u=>this.set("credentials_only",u.target.checked)}> Nur diese Zugänge erlauben</label></div>
        ${H.external?.has_access||C.no_external?t`<div class="card"><h3>${d("euro",18)} Externe Modelle</h3>
          <label class="row hint"><input type="checkbox" style="width:auto" .checked=${!!C.no_external} @change=${u=>this.set("no_external",u.target.checked)}> Nie an kostenpflichtige externe Modelle senden</label>
          <div class="hint" style="margin-top:6px">Für Projekte mit sensiblen Inhalten: Chats und Aufgaben dieses Projekts laufen dann nur beim Hauptanbieter – auch im Notfall.</div></div>`:s}
        <div class="card"><h3>${d("skill",18)} ${p("Skills")}</h3><div class="chips">
          ${(H.skills||[]).map(u=>t`<button class=${(C.skills||[]).includes(u.id)?"on":""} @click=${()=>this.toggle("skills",u.id)}>${u.name}</button>`)}
          ${(H.skills||[]).length?s:t`<span class="hint">Noch keine Skills angelegt.</span>`}</div>
          <label class="row hint" style="margin-top:8px"><input type="checkbox" style="width:auto" .checked=${!!C.skills_only} @change=${u=>this.set("skills_only",u.target.checked)}> Nur diese Skills anbieten</label></div>
        ${o?s:t`<div class="card"><h3>${d("sparkle",18)} Modelle</h3>
          <label class="f"><span>Chat</span><select @change=${u=>this.set("model_chat",u.target.value||null)}>
            <option value="">${c5("chat")}</option>${L.filter(u=>!u.external).map(u=>t`<option value=${u.id} ?selected=${C.model_chat===u.id}>${u.name}</option>`)}</select></label>
          <label class="f" style="margin-top:8px"><span>Cowork / Aufgaben</span><select @change=${u=>this.set("model_agent",u.target.value||null)}>
            <option value="">${c5("agent")}</option>${L.filter(u=>!u.external).map(u=>t`<option value=${u.id} ?selected=${C.model_agent===u.id}>${u.name}</option>`)}</select></label></div>`}
        <div class="card"><h3>${d("tools",18)} ${p("Werkzeuge")} & Freigaben</h3>
          <div class="chips">${Object.entries(i).filter(([u])=>!["files","skills","progress","ha"].includes(u)).map(([u,b])=>{let x=C.tool_groups==null||C.tool_groups.includes(u);return t`<button class=${x?"on":""} @click=${()=>{let f=Object.keys(i),w=new Set(C.tool_groups??f);w.has(u)?w.delete(u):w.add(u),this.set("tool_groups",[...w])}}>${b.label}</button>`})}</div>
          <div class="hint" style="margin:6px 0 0">${i.ha?.label||"Home Assistant"} ist immer dabei; Schaltaktionen fragen wie unten eingestellt nach.</div>
          <div class="hint" style="margin:10px 0 6px">Schreibende Aktionen:</div>
          ${M.map(([u,b])=>t`<div class="row" style="padding:3px 0;font-size:13px"><span class="grow">${b.label}</span>
            <select style="width:auto;padding:4px 6px" @change=${x=>this.set("permissions",{...C.permissions||{},[u]:x.target.value})}>
              ${[["ask","fragen"],["allow","erlauben"],["deny","verbieten"]].map(([x,f])=>t`<option value=${x} ?selected=${((C.permissions||{})[u]||"ask")===x}>${f}</option>`)}</select></div>`)}</div>`)}
        <button class="btn danger" @click=${async()=>{if(await v1(`Projekt \u201E${C.name}\u201C l\xF6schen? Chats bleiben erhalten (ohne Projekt).`))try{await A.api.ws("project/delete",{project_id:C.id}),await A.load(),O("/projects")}catch(u){A.notify(u.message)}}}>${d("trash",16)} Projekt löschen</button>
      </div></div>`:t`<div class="lock">${d("project",26)}<b>Neues Projekt</b><span class="hint">Gib einen Namen ein und speichere – danach kannst du Dateien hochladen und Chats und Coworks in diesem Projekt starten.</span>
        <div class="row" style="justify-content:center;margin-top:6px"><button class="btn" @click=${()=>O("/projects")}>${p("Abbrechen")}</button>
        <button class="btn primary" @click=${this.save} ?disabled=${!String(C.name||"").trim()}>${d("check",16)} Projekt anlegen</button></div></div>
        <h2>${a}</h2><textarea rows="10" placeholder=${m}
          .value=${C.instructions||""} @input=${u=>this.set("instructions",u.target.value)}></textarea>`}
      ${this.dirty&&C.id?t`<div class="savebar fade-in"><button class="btn" @click=${()=>this.reload()}>${p("Abbrechen")}</button>
        <button class="btn primary" @click=${this.save}>${d("check",16)} ${p("Speichern")}</button></div>`:s}
    </div>`}};I1.styles=[j,x5,B`:host { display: block; height: 100%; overflow-y: auto; }
    .cols { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 28px; align-items: start; }
    .side { display: grid; gap: 14px; }
    .side .card h3 { margin: 0 0 10px; font-size: 13.5px; display: flex; gap: 6px; align-items: center; }
    .tw { position: relative; flex: 1; min-width: 0; }
    .title { font-family: var(--lm-head); font-weight: 650; font-size: 24px; padding: 8px 44px 8px 12px; border: 1px solid var(--lm-line);
      background: var(--lm-panel); border-radius: 12px; }
    .title:hover { border-color: color-mix(in srgb, var(--lm-accent) 35%, var(--lm-line)); }
    .tw .pen { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); color: var(--lm-faint); pointer-events: none; }
    .lock { display: grid; place-items: center; text-align: center; gap: 8px; padding: 28px 16px; border: 1px dashed var(--lm-line); border-radius: 16px; color: var(--lm-muted); }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .chips button { border: 1px solid var(--lm-line); background: var(--lm-panel); border-radius: 999px; padding: 4px 10px; font-size: 12.5px; cursor: pointer; display: inline-flex; gap: 4px; align-items: center; max-width: 100%; overflow-wrap: anywhere; text-align: left; }
    .chips button.on { background: var(--lm-accent-soft); border-color: transparent; color: var(--lm-accent); }
    .savebar { position: sticky; bottom: 12px; display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; }
    @media (max-width: 900px) { .cols { grid-template-columns: minmax(0, 1fr); } }`],h([T()],I1.prototype,"projectId",2),h([k()],I1.prototype,"draft",2),h([k()],I1.prototype,"files",2),h([k()],I1.prototype,"dirty",2),I1=h([F("lm-project")],I1);var Z5=B`
  .tu { display: grid; gap: 12px; }
  .tu-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; }
  .tu-grid .big { font-size: 15px; font-weight: 600; margin-top: 2px; font-variant-numeric: tabular-nums; }
  .tu-bars { display: flex; align-items: flex-end; gap: 3px; height: 64px; }
  .tu-bars div { flex: 1; background: var(--lm-accent); border-radius: 3px 3px 0 0; min-height: 2px; opacity: .8; }
  .tu-bars div.today { opacity: 1; }
  .tu-bars div:hover { opacity: 1; }
  .tu .warnline { color: var(--lm-warn); }`,a0=r=>(r?.prompt||0)+(r?.completion||0),vC=r=>{let[,V,C]=r.split("-");return`${C}.${V}.`};function f7(r){return r==="shared"?"zentraler Aufgaben-Schl\xFCssel":r==="own"?"eigener Aufgaben-Schl\xFCssel":"gleicher Schl\xFCssel wie Chats & Coworks"}function o0(r){let V=r.limits||{},C=r.days||[],H=C.filter(M=>M.requests),e=Math.max(1,...C.map(M=>M.requests||0)),L=H.length?Math.round(H.reduce((M,o)=>M+o.requests,0)/H.length):0,i=H.length?H.reduce((M,o)=>M+a0(o),0)/H.length:0;return t`<div class="card tu">
    <div class="row" style="flex-wrap:wrap"><b class="grow">${d("task",16)} ${r.title}</b>
      ${r.label?t`<span class="chip ${r.accent?"accent":""}">${d("key",13)} ${r.label}</span>`:s}</div>
    <div class="tu-grid">
      <div><div class="hint">${r.todayLabel}</div><div class="big">${r.today?.requests||0} Anfragen · ${I(a0(r.today))} Tokens</div></div>
      ${r.mine?t`<div><div class="hint">davon deine Aufgaben</div><div class="big">${r.mine.requests||0} Anfragen · ${I(a0(r.mine))} Tokens</div></div>`:s}
      ${V.limit_requests_day?t`<div><div class="hint">Schlüssel heute noch frei (alle Nutzungen)</div>
        <div class="big">${V.remaining_requests_day??V.limit_requests_day} / ${V.limit_requests_day} Anfragen</div>
        ${V.reset_requests_day?t`<div class="hint">setzt in ${x1(V.reset_requests_day)} zurück</div>`:s}</div>`:s}
    </div>
    ${C.length?t`<div><div class="tu-bars">${C.map((M,o)=>t`<div class=${o===C.length-1?"today":""}
        title="${vC(M.day)}: ${M.requests} Anfragen, ${I(a0(M))} Tokens" style="height:${Math.max(2,M.requests/e*60)}px"></div>`)}</div>
      <div class="hint">Anfragen je Tag, letzte ${C.length} Tage${H.length?` \xB7 \xD8 ${L} Anfragen und ${I(i)} Tokens an Tagen mit L\xE4ufen`:""}</div></div>`:s}
    ${(r.notes||[]).filter(Boolean).map(M=>t`<div class="hint">${M}</div>`)}
  </div>`}function n0(r,V){return r?r.has_key?o0({title:"Verbrauch der geplanten Aufgaben",label:f7(r.source),accent:r.separate,todayLabel:r.shared_by_all?"Alle geplanten Aufgaben auf diesem Schl\xFCssel heute":"Deine geplanten Aufgaben heute",today:r.key_today,mine:r.shared_by_all?r.mine_today:void 0,limits:r.key_limits,days:V,notes:[r.fallback?t`<span class="warnline">${d("alert",13)} Der gewählte Aufgaben-Schlüssel ist nicht eingetragen – Aufgaben nutzen so lange den normalen Schlüssel.</span>`:null,r.missing?t`<span class="warnline">${d("alert",13)} Ohne eigenen Aufgaben-Schlüssel starten keine Läufe – der Admin lässt Aufgaben nur mit eigenen Schlüsseln laufen.</span>`:null,!r.separate&&!r.fallback?"Aufgaben teilen sich die Limits mit Chats und Coworks.":null,r.separate?"L\xE4ufe auf diesem Schl\xFCssel z\xE4hlen nicht zum pers\xF6nlichen Tageskontingent.":null]}):t`<div class="card hint">${r.missing?"F\xFCr geplante Aufgaben fehlt dein eigener API-Schl\xFCssel \u2013 der Admin l\xE4sst Aufgaben nur mit eigenen Schl\xFCsseln laufen. Trag ihn in den Einstellungen ein.":"F\xFCr geplante Aufgaben ist noch kein API-Schl\xFCssel hinterlegt."}</div>`:s}var z2=B`:host { display: block; height: 100%; overflow-y: auto; }
  ${x5}
  .form { display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; }
  .two { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px; }
  .savebar { position: sticky; bottom: 12px; display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
  .banner { display: flex; gap: 10px; align-items: flex-start; background: var(--lm-accent-soft); color: var(--lm-text); border-radius: 12px;
    padding: 12px 14px; font-size: 13.5px; line-height: 1.5; margin-bottom: 16px; }
  .banner .i { color: var(--lm-accent); margin-top: 1px; }
  .switch { position: relative; width: 40px; height: 24px; flex: none; }
  .switch input { opacity: 0; width: 0; height: 0; }
  .switch span { position: absolute; inset: 0; background: var(--lm-line); border-radius: 999px; transition: .2s; cursor: pointer; }
  .switch span::after { content: ""; position: absolute; width: 18px; height: 18px; left: 3px; top: 3px; background: #fff; border-radius: 50%; transition: .2s; box-shadow: 0 1px 3px rgba(0,0,0,.2); }
  .switch input:checked + span { background: var(--lm-accent); } .switch input:checked + span::after { transform: translateX(16px); }
  .days { display: flex; gap: 4px; flex-wrap: wrap; } .days button { width: 40px; height: 36px; border-radius: 9px; border: 1px solid var(--lm-line); background: var(--lm-panel); cursor: pointer; }
  .days button.on { background: var(--lm-accent); color: var(--lm-on-accent); border-color: var(--lm-accent); }
  .checks { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 6px; }
  .checks label { display: flex; gap: 8px; align-items: center; font-size: 13.5px; padding: 6px 8px; border: 1px solid var(--lm-line); border-radius: 9px; cursor: pointer; background: var(--lm-panel); }
  .checks input { width: auto; }
  .tabs { display: flex; gap: 4px; } .tabs button { border: 0; background: none; padding: 6px 10px; border-radius: 8px; cursor: pointer; color: var(--lm-muted); }
  .tabs button.on { background: var(--lm-hover); color: var(--lm-text); }
  .st-narrow { display: none; margin-top: 6px; }
  @media (max-width: 640px) { .st-wide { display: none; } .st-narrow { display: block; } }
  .preview { border: 1px solid var(--lm-line); border-radius: 10px; padding: 14px; background: var(--lm-panel); min-height: 200px; }
  /* Zugang, dessen letzte Pruefung fehlgeschlagen ist: sofort ins Auge fallend */
  .item.cred.bad { border-color: var(--lm-err); background: color-mix(in srgb, var(--lm-err) 7%, var(--lm-panel)); }
  .item.cred.bad > .i { color: var(--lm-err); }
  .item.cred.bad:hover { border-color: var(--lm-err); }
  /* Aufgabe, deren Lauf an der Hoechstzahl an Schritten gescheitert ist: rot, bis sie freigegeben wird */
  .item.task.bad { border-color: var(--lm-err); background: color-mix(in srgb, var(--lm-err) 7%, var(--lm-panel)); }
  .item.task.bad > .i { color: var(--lm-err); }
  .item.task.bad:hover { border-color: var(--lm-err); }
  .cred-err { color: var(--lm-err); font-size: 12.5px; line-height: 1.4; overflow-wrap: anywhere; }
  .checkbox { display: flex; gap: 10px; align-items: flex-start; border-radius: 12px; padding: 12px 14px; font-size: 13.5px; line-height: 1.5; }
  .checkbox.ok { background: rgba(63,143,91,.10); }
  .checkbox.err { background: rgba(194,69,59,.10); border: 1px solid var(--lm-err); }
  .checkbox .i { flex: none; margin-top: 1px; }
  .checkbox.ok .i { color: var(--lm-ok); } .checkbox.err .i { color: var(--lm-err); }
  @media (max-width: 640px) { .two { grid-template-columns: 1fr; } }`,b7=(r,V)=>t`<label class="switch" @click=${C=>C.stopPropagation()}><input type="checkbox" .checked=${r} @change=${C=>V(C.target.checked)}><span></span></label>`,s0=r=>(r||[]).filter(V=>V.limit_hit&&!V.heavy),F2=class extends e1{constructor(){super(...arguments);this.keyDays=null}connectedCallback(){super.connectedCallback(),A.api.ws("usage/history").then(C=>this.keyDays=C.task_key_days||[]).catch(()=>{})}status(C){let H=A.data?.queue||{};if(H.running===C.id)return t`<span class="chip accent"><lm-spark size="14"></lm-spark> läuft</span>`;if(H.position?.[C.id])return t`<span class="chip warn">${d("wait",13)} wartet (Platz ${H.position[C.id]})</span>`;let e=C.last_run;return e?e.status==="running"?t`<span class="chip accent">läuft</span>`:e.status==="done"?t`<span class="chip ok">${d("check",13)} ${D(e.finished)}</span>`:t`<span class="chip err">${d("alert",13)} ${D(e.finished)}</span>`:t`<span class="chip">noch nie gelaufen</span>`}liveDays(){let C=this.keyDays,H=A.data?.usage?.tasks?.key_today;return!C?.length||!H?C:[...C.slice(0,-1),{...C[C.length-1],...H}]}render(){let C=A.data?.tasks||[];return t`<div class="page"><div class="row"><h1 class="grow">${E()?p("Geplante Aufgaben"):p("Geplant")}</h1>
      <button class="btn primary" @click=${()=>O("/task/new")}>${d("plus",18)} ${p("Neue Aufgabe")}</button></div>
      ${E()?E2("tasks",!C.length):t`
      <div class="banner">${d("hourglass")}<div><b>Geplante Aufgaben laufen mit Open-Weight-Modellen.</b> Sie starten in einer gemeinsamen Warteschlange und
        können sich verzögern, wenn die Modelle ausgelastet sind oder ein Limit erreicht ist – dann wartet LLMitMir und versucht es weiter (bis zu 6 Stunden).
        Einzelne Läufe können auch selbst lange dauern. Plane deshalb nichts, das auf die Minute genau fertig sein muss.</div></div>`}
      ${A.data?.usage?.tasks?.missing?t`<div class="banner" style="background:color-mix(in srgb, var(--lm-err) 10%, var(--lm-panel))">${d("key")}
        <div><b>Für geplante Aufgaben fehlt dein eigener API-Schlüssel.</b> Der Admin hat festgelegt, dass Aufgaben nur mit eigenen Schlüsseln laufen –
        ohne ihn startet kein Lauf. <a href="#" @click=${H=>{H.preventDefault(),O("/settings")}}>In den Einstellungen eintragen</a>.</div></div>`:s}
      ${C.length&&!E()?t`<div style="margin-bottom:16px">${n0(A.data?.usage?.tasks,this.liveDays())}</div>`:s}
      ${s0(C).length?t`<div class="checkbox err" style="margin-bottom:14px">${d("alert",18)}
        <div><b>${s0(C).length===1?"Eine Aufgabe hat die H\xF6chstzahl an Schritten erreicht":`${s0(C).length} Aufgaben haben die H\xF6chstzahl an Schritten erreicht`}:</b>
        ${s0(C).map(H=>H.name).join(", ")}. Öffne die Aufgabe und gib sie für mehr Schritte frei – dann hat ein Lauf bis zu 150 statt 60 Schritte.</div></div>`:s}
      <div class="list">${C.length?C.map(H=>t`<div class="item task ${H.limit_hit&&!H.heavy?"bad":""}" @click=${()=>O(`/task/${H.id}`)}>
        ${d("task")}<div class="grow"><div class="row" style="flex-wrap:wrap"><span class="clamp2">${H.name}</span>${H.imported&&!H.enabled?t`<span class="chip warn">importiert – prüfen</span>`:s}
          ${H.heavy?t`<span class="chip" title="Besonders aufwändig: bis zu 150 Schritte je Lauf">${d("list",13)} 150 Schritte</span>`:s}
          ${H.limit_hit&&!H.heavy?t`<span class="chip err" title="Ein Lauf hat die Höchstzahl von 60 Schritten erreicht – die Aufgabe lässt sich für 150 Schritte freigeben">${d("alert",13)} Schritte erschöpft</span>`:s}
          ${H.limit_hit&&H.heavy?t`<span class="chip warn" title="Auch 150 Schritte haben für einen Lauf nicht gereicht">${d("alert",13)} 150 Schritte erschöpft</span>`:s}
          ${H.werkbank_missing?t`<span class="chip err" title=${H.requires_note||""}>${d("mdi:console",13)} braucht Werkbank</span>`:(H.requires||[]).includes("werkbank")?t`<span class="chip">${d("mdi:console",13)} nutzt Werkbank</span>`:s}
          ${H.external_fallback?t`<span class="chip" title="Darf im Notfall auf kostenpflichtige externe Modelle ausweichen">${d("euro",13)} Notfall extern</span>`:s}
          ${H.last_run?.external?t`<span class="chip warn" title="Der letzte Lauf lief über ein externes Modell">${d("euro",13)} zuletzt extern</span>`:s}</div>
          <div class="hint">${H.schedule_text}${H.enabled&&H.next_run?` \xB7 n\xE4chster Lauf ${D(H.next_run)}`:""}${H.schedule_error?` \xB7 \u26A0 ${H.schedule_error}`:""}</div>
          <div class="st-narrow">${this.status(H)}</div></div>
        <span class="st-wide">${this.status(H)}</span>
        <button class="iconbtn" title=${p("Jetzt ausf\xFChren")} @click=${async e=>{e.stopPropagation();let L=await A.api.ws("task/run_now",{task_id:H.id});A.notify(L.position>0?`In der Warteschlange (Platz ${L.position})`:"L\xE4uft bereits oder wartet schon")}}>${d("play")}</button>
        ${b7(!!H.enabled,async e=>{await A.api.ws("task/save",{task:{...H,enabled:e}})})}
      </div>`):t`<div class="hint">${E()?"Noch keine geplanten Aufgaben.":"Noch keine geplanten Aufgaben. Lege eine an oder importiere sie aus Claude (Einstellungen \u2192 Import)."}</div>`}</div></div>`}};F2.styles=[j,z2,Z5],h([k()],F2.prototype,"keyDays",2),F2=h([F("lm-tasks")],F2);var _1=class extends e1{constructor(){super(...arguments);this.taskId="";this.d=null;this.preview=null;this.dirty=!1;this.people=null}updated(C){C.has("taskId")&&this.reload()}connectedCallback(){super.connectedCallback(),this.loadPeople()}async loadPeople(){try{this.people=(await A.api.ws("task/people")).people||[]}catch{this.people=[]}}reload(){let C=(A.data?.tasks||[]).find(H=>H.id===this.taskId);this.d=C?JSON.parse(JSON.stringify(C)):{name:"",prompt:"",schedule:{type:"daily",time:"08:00"},enabled:!0,notify:"always",allow_write:["notify"],share:{users:[]}},this.d.share||(this.d.share={users:[]}),this.dirty=this.taskId==="new",this.loadPreview()}shareUsers(){return this.d?.share?.users||[]}setShare(C){this.d={...this.d,share:{users:C}},this.dirty=!0}toggleShare(C,H){let e=this.shareUsers().filter(L=>L.user_id!==C);H&&e.push({user_id:C,edit:!1,notify:!1}),this.setShare(e)}setShareFlag(C,H,e){this.setShare(this.shareUsers().map(L=>L.user_id===C?{...L,[H]:e}:L))}set(C,H){this.d={...this.d,[C]:H},this.dirty=!0}sched(C,H){this.d={...this.d,schedule:{...this.d.schedule,[C]:H}},this.dirty=!0,this.loadPreview()}async loadPreview(){try{this.preview=await A.api.ws("task/preview",{schedule:this.d.schedule})}catch(C){this.preview={error:C.message}}}async save(){try{let C=await A.api.ws("task/save",{task:this.d});this.dirty=!1,A.notify(p("Gespeichert")),await A.load(),this.taskId==="new"&&O(`/task/${C.id}`,!0)}catch(C){A.notify(C.message)}}fallbackCard(C){let H=r1();if(!H.has_access&&!C.external_fallback)return s;let e=E();return t`<div class="card"><label class="row" style="gap:10px"><input type="checkbox" style="width:auto" .checked=${!!C.external_fallback}
        @change=${async L=>{let i=L.target.checked;if(i&&!await B2()){L.target.checked=!1;return}this.set("external_fallback",i)}}>
        <b>${e?"Im Notfall mit einer kostenpflichtigen Ersatz-KI ausf\xFChren":"Im Notfall auf kostenpflichtige externe Modelle ausweichen"}</b></label>
      <div class="hint" style="margin:4px 0 0">Ist der Hauptanbieter gerade nicht nutzbar (z. B. Limit erreicht), läuft diese Aufgabe dann über ein externes Modell
        (${(H.providers||[]).filter(L=>L.id!=="main").map(L=>L.operator).join(" oder ")||"Claude"}), statt auszufallen. Dabei gehen der Auftrag
        und die Ergebnisse der Werkzeuge dorthin – nie Passwörter, und nur Zugänge, die für externe Modelle freigegeben sind. Kosten zählen zu deinem
        Monatslimit (${G(H.month_eur||0)} von ${G(H.limit_eur||0)} verbraucht). Bitte nur ankreuzen, wenn der Auftrag keine sensiblen Informationen enthält.</div></div>`}stepsCard(C){let H=E(),e=!!C.limit_hit&&!C.heavy;return t`<div class="card" style=${e?"border-color:var(--lm-err);background:color-mix(in srgb, var(--lm-err) 7%, var(--lm-panel))":""}>
      ${e?t`<div class="checkbox err" style="margin:0 0 14px">${d("alert",18)}
        <div><b>Diese Aufgabe hat die Höchstzahl von 60 Schritten erreicht.</b> Ein Lauf wurde deshalb abgebrochen, bevor er fertig war.
        Gib die Aufgabe hier für mehr Schritte frei – dann hat jeder Lauf bis zu 150 Schritte.</div></div>`:s}
      <label class="row" style="gap:10px"><input type="checkbox" style="width:auto" .checked=${!!C.heavy}
        @change=${L=>this.set("heavy",L.target.checked)}>
        <b>${H?"Besonders aufw\xE4ndige Aufgabe (mehr Schritte)":"Besonders aufw\xE4ndig \u2013 bis zu 150 Schritte je Lauf"}</b></label>
      <div class="hint" style="margin:4px 0 0">Normal sind es 60 Schritte je Lauf. Reicht das für eine Aufgabe nicht (viele Dateien, viele Abfragen,
        lange Prüfungen), bekommt sie mit dieser Markierung bis zu 150. Ein Lauf dauert dann entsprechend länger und verbraucht mehr Kontingent.</div>
      ${e?t`<div class="row" style="margin-top:12px"><button class="btn primary" @click=${async()=>{this.set("heavy",!0),await this.save()}}>${d("check",16)} Für 150 Schritte freigeben</button></div>`:s}
      ${C.limit_hit&&C.heavy?t`<div class="hint" style="margin-top:10px">Auch 150 Schritte haben für einen Lauf nicht gereicht. Teile die Aufgabe auf
        oder formuliere den Auftrag enger – mehr Schritte gibt es nicht.</div>`:s}</div>`}shareCard(C){let H=E(),e=this.shareUsers(),L=this.people||[],i=new Set(e.map(o=>o.user_id)),M=e.filter(o=>!L.some(l=>l.id===o.user_id));return t`<div class="card"><b>${H?"Mit anderen teilen":"Teilen"}</b>
      <div class="hint" style="margin:4px 0 10px">${H?"Andere Personen in diesem Home Assistant sehen die Aufgabe dann unter \u201EGeplant\u201C. Du entscheidest, wer sie auch \xE4ndern darf und wer bei jedem Lauf eine Nachricht aufs eigene Handy bekommt.":"Die Aufgabe erscheint bei den gew\xE4hlten Personen unter \u201EGeplant\u201C. \u201EBearbeiten\u201C erlaubt \xC4nderungen und \u201EJetzt ausf\xFChren\u201C, \u201EBenachrichtigen\u201C schickt jedem Lauf eine Nachricht auf das Ger\xE4t der Person. L\xF6schen und das Teilen selbst bleiben bei dir."}</div>
      ${L.length?t`<div class="share">${L.map(o=>{let l=e.find(a=>a.user_id===o.id);return t`<div class="who"><span class="nm">${o.name}</span>
          <label><input type="checkbox" .checked=${!!l} @change=${a=>this.toggleShare(o.id,a.target.checked)}> sehen</label>
          <label><input type="checkbox" ?disabled=${!l} .checked=${!!l?.edit} @change=${a=>this.setShareFlag(o.id,"edit",a.target.checked)}> bearbeiten</label>
          <label><input type="checkbox" ?disabled=${!l} .checked=${!!l?.notify} @change=${a=>this.setShareFlag(o.id,"notify",a.target.checked)}> Benachrichtigung</label></div>`})}</div>`:t`<div class="hint">Es gibt keine weiteren Personen, die LLMitMir nutzen dürfen. Admins legen das unter Admin → Personen fest.</div>`}
      ${M.length?t`<div class="hint">Nicht mehr verfügbar: ${M.map(o=>o.name||o.user_id).join(", ")}</div>`:s}
      ${C.id?s:t`<div class="hint" style="margin-top:8px">Teilen lässt sich erst nach dem ersten Speichern einstellen.</div>`}</div>`}readOnly(C){let H=(A.data?.tasks||[]).find(L=>L.id===C.id)||C,e=(H.runs||[]).map(L=>(A.data?.chats||[]).find(i=>i.id===L)).filter(Boolean);return t`<div class="page">
      <div class="row"><button class="iconbtn" @click=${()=>O("/tasks")}>${d("left")}</button><h1 class="grow">${C.name||"Aufgabe"}</h1></div>
      <div class="banner">${d("info")}<div>Diese Aufgabe gehört <b>${C.owner_name||"jemand anderem"}</b>. Du kannst sie ansehen, aber nicht ändern.</div></div>
      <div class="form">
        <div class="card"><b>${p("Zeitplan")}</b><div class="hint" style="margin-top:6px">${C.schedule_text||""}</div></div>
        <div class="card"><b>${p("Auftrag")}</b><div class="md" style="margin-top:6px">${T1(C.prompt||"")}</div></div>
        <div class="card"><b>${E()?"Nachricht aufs Handy":p("Benachrichtigen")}</b>
          <div class="hint" style="margin-top:6px">${C.can_notify?"Du bekommst bei jedem Lauf eine Nachricht auf dein Ger\xE4t.":"Du bekommst keine eigene Nachricht zu dieser Aufgabe."}</div></div>
      </div>
      <h2>${E()?"Bisherige Ergebnisse":p("L\xE4ufe")}</h2><div class="list">
        ${e.length?e.map(L=>t`<div class="item" @click=${()=>O(`/chat/${L.id}`)}>
          ${A.runs[L.id]||L.status==="running"?t`<lm-spark size="18"></lm-spark>`:d(L.status==="error"?"alert":"check",18)}
          <span class="grow ellipsis">${L.title}</span><span class="hint">${D(L.updated)}</span></div>`):t`<div class="hint">Noch keine Läufe.</div>`}</div>
      ${H.last_run?.summary?t`<h2>Letztes Ergebnis</h2><div class="card md">${T1(H.last_run.summary)}</div>`:s}
    </div>`}render(){let C=this.d;if(!C)return s;if(C.shared&&!C.can_edit)return this.readOnly(C);let H=A.data,e=C.schedule||{},L=Object.entries(H.tools||{}).filter(([,x])=>x.write&&!x.confirm),i=(H.tasks||[]).find(x=>x.id===C.id)||C,M=(i.runs||[]).map(x=>(H.chats||[]).find(f=>f.id===x)).filter(Boolean),o=C.id?H.queue?.position?.[C.id]:0,l=["So","Mo","Di","Mi","Do","Fr","Sa"],a=E(),m=[["daily","t\xE4glich"],["weekdays","werktags (Mo\u2013Fr)"],["weekly","an bestimmten Wochentagen"],["monthly","monatlich"],["interval","alle n Stunden"],["hourly","st\xFCndlich"],["once","einmalig"],["cron","eigener Cron-Ausdruck"]].filter(([x])=>!a||["daily","weekdays","weekly","monthly","once"].includes(x)||x===e.type),c=t`<label class="f"><span>${p("Projekte")}</span><select @change=${x=>this.set("project_id",x.target.value||null)}>
      <option value="">Ohne Projekt</option>${(H.projects||[]).map(x=>t`<option value=${x.id} ?selected=${C.project_id===x.id}>${x.name}</option>`)}</select></label>`,u=a?"Was darf die Aufgabe selbst tun?":"Freigaben f\xFCr schreibende Aktionen",b=a?"Die Aufgabe l\xE4uft, ohne dich zu fragen. Sie darf nur, was hier angehakt ist \u2013 zum Beispiel dir eine Nachricht schicken.":"L\xE4ufe sind unbeaufsichtigt und k\xF6nnen nicht nachfragen. Nur hier angehakte Aktionen sind erlaubt, alles andere wird abgelehnt.";return t`<div class="page">
      <div class="row"><button class="iconbtn" @click=${()=>O("/tasks")}>${d("left")}</button><h1 class="grow">${C.id?C.name||"Aufgabe":p("Neue Aufgabe")}</h1>
        ${C.id&&C.can_edit!==!1?t`<button class="btn" @click=${async()=>{let x=await A.api.ws("task/run_now",{task_id:C.id});A.notify(x.position>0?`In der Warteschlange (Platz ${x.position})`:"L\xE4uft bereits")}}>${d("play",16)} ${p("Jetzt ausf\xFChren")}</button>`:s}</div>
      ${C.shared?t`<div class="banner">${d("info")}<div>Diese Aufgabe gehört <b>${C.owner_name||"jemand anderem"}</b> und ist mit dir geteilt. Du darfst sie ändern und starten – löschen und weitergeben kann sie nur ${C.owner_name||"die Person, der sie geh\xF6rt"}.</div></div>`:s}
      ${C.imported&&!C.enabled?t`<div class="banner">${d("info")}<div>Aus Claude importiert und deshalb pausiert. Prüfe Auftrag, Zugänge und Freigaben – Verweise auf Claude-Werkzeuge
        (z. B. Gmail-Connector, list_triggers) gibt es hier nicht.${C.imported_note?t`<br><i>${C.imported_note}</i>`:s}</div></div>`:s}
      ${C.werkbank_missing?t`<div class="banner" style="background:color-mix(in srgb, var(--lm-err) 10%, var(--lm-panel))">${d("mdi:console")}<div>
        <b>Für diese Aufgabe fehlt die Werkbank.</b> Sie läuft trotzdem, erledigt aber nur, was ohne Werkbank geht, und nennt im Ergebnis, was ausgelassen wurde.
        ${C.requires_note?t`<br><i>Ohne Werkbank fehlt: ${C.requires_note}</i>`:s}
        <br><a href="#" @click=${x=>{x.preventDefault(),O("/settings")}}>Was ist die Werkbank und wie richte ich sie ein?</a></div></div>`:s}
      <div class="form">
        <label class="f"><span>${p("Name")}</span><input .value=${C.name} @input=${x=>this.set("name",x.target.value)}></label>
        <label class="f"><span>${a?"Was soll passieren?":p("Auftrag")}</span><textarea rows=${a?8:14} placeholder=${a?"Zum Beispiel: Schau dir die Wettervorhersage f\xFCr heute an und schick mir eine kurze Zusammenfassung \u2013 mit dem Hinweis, ob ich einen Schirm brauche.":"Was soll bei jedem Lauf passieren? So genau wie f\xFCr einen Menschen, der das zum ersten Mal macht."}
          .value=${C.prompt} @input=${x=>this.set("prompt",x.target.value)}></textarea></label>
        <div class="card"><b>${p("Zeitplan")}</b>
          <div class="two" style="margin-top:10px">
            <label class="f"><span>Wiederholung</span><select @change=${x=>this.sched("type",x.target.value)}>
              ${m.map(([x,f])=>t`<option value=${x} ?selected=${e.type===x}>${f}</option>`)}</select></label>
            ${["daily","weekdays","weekly","monthly","interval"].includes(e.type)?t`<label class="f"><span>Uhrzeit${e.type==="interval"?" (Minute z\xE4hlt)":""}</span>
              <input type="time" .value=${e.time||"08:00"} @change=${x=>this.sched("time",x.target.value)}></label>`:s}
            ${e.type==="interval"?t`<label class="f"><span>Alle … Stunden</span><input type="number" min="1" max="23" .value=${String(e.hours||2)} @change=${x=>this.sched("hours",Number(x.target.value))}></label>`:s}
            ${e.type==="hourly"?t`<label class="f"><span>Zur Minute</span><input type="number" min="0" max="59" .value=${String(e.minute||0)} @change=${x=>this.sched("minute",Number(x.target.value))}></label>`:s}
            ${e.type==="monthly"?t`<label class="f"><span>Tag im Monat</span><input type="number" min="1" max="31" .value=${String(e.day||1)} @change=${x=>this.sched("day",Number(x.target.value))}></label>`:s}
            ${e.type==="once"?t`<label class="f"><span>Zeitpunkt</span><input type="datetime-local" .value=${(e.at||"").slice(0,16)} @change=${x=>this.sched("at",x.target.value)}></label>`:s}
            ${e.type==="cron"?t`<label class="f"><span>Cron (Minute Stunde Tag Monat Wochentag)</span><input class="code" placeholder="23 6 * * *" .value=${e.cron||""} @change=${x=>this.sched("cron",x.target.value)}></label>`:s}
          </div>
          ${e.type==="weekly"?t`<div class="days" style="margin-top:10px">${[1,2,3,4,5,6,0].map(x=>t`<button class=${(e.days||[1]).includes(x)?"on":""}
            @click=${()=>{let f=new Set(e.days||[1]);f.has(x)?f.delete(x):f.add(x),this.sched("days",[...f])}}>${l[x]}</button>`)}</div>`:s}
          <div class="hint" style="margin-top:10px">${this.preview?.error?t`<span style="color:var(--lm-err)">${this.preview.error}</span>`:t`${this.preview?.text||""}${this.preview?.next?.length?t` · nächste Läufe: ${this.preview.next.slice(0,3).map(x=>D(x)).join(", ")}`:""}
            <br>${a?"Ist gerade viel los, startet die Aufgabe manchmal etwas sp\xE4ter.":"Geplant ist der Start \u2013 mit Open-Weight-Modellen beginnt ein Lauf oft sp\xE4ter und kann l\xE4nger dauern."}`}</div></div>
        ${a?s:t`<div class="two">
          ${c}
          <label class="f"><span>${p("Modell")}</span><select @change=${async x=>{let f=x.target.value||null;if(f&&h1(f)&&!await B2()){x.target.value=C.model||"";return}this.set("model",f)}}>
            <option value="">${c5("agent")}</option>
            ${(H.models||[]).filter(x=>!x.external).map(x=>t`<option value=${x.id} ?selected=${C.model===x.id}>${x.name}</option>`)}
            ${(H.models||[]).some(x=>x.external)?t`<optgroup label="Kostenpflichtig (extern)">${(H.models||[]).filter(x=>x.external).map(x=>t`<option value=${x.id} ?selected=${C.model===x.id}>${x.name}${x.locked?" \u2013 nur im Notfall":""}</option>`)}</optgroup>`:s}</select>
            ${h1(C.model)?t`<span class="hint">${d("euro",13)} Jeder Lauf kostet Geld (${v5((H.models||[]).find(x=>x.id===C.model)?.price)}). Ist das Modell gerade nicht wählbar, läuft die Aufgabe beim Hauptanbieter.</span>`:s}</label>
        </div>`}
        ${this.fallbackCard(C)}
        ${this.stepsCard(C)}
        <div class="two">
          <label class="f"><span>${a?"Nachricht aufs Handy":p("Benachrichtigen")}</span><select @change=${x=>this.set("notify",x.target.value)}>
            ${[["always","nach jedem Lauf"],["on_change","nur bei neuem Ergebnis, R\xFCckfrage oder Fehler"],["error","nur bei Fehlern"],["never","nie"]].map(([x,f])=>t`<option value=${x} ?selected=${C.notify===x}>${f}</option>`)}</select>
            ${H.settings.notify_device?s:t`<span class="hint">Wähle zuerst in den Einstellungen dein Gerät für Benachrichtigungen.</span>`}</label>
          <label class="f"><span>${p("Aktiv")}</span><div class="row" style="min-height:40px">${b7(!!C.enabled,x=>this.set("enabled",x))}<span class="muted">${C.enabled?p("Aktiv"):p("Pausiert")}</span></div></label>
        </div>
        ${C.shared?s:this.shareCard(C)}
        ${(a?x=>R2(x,"Mehr Optionen: Projekt, Freigaben, Werkbank"):x=>x)(t`${a?c:s}
        <div class="card"><b>${u}</b><div class="hint" style="margin:4px 0 10px">${b}</div>
          <div class="checks">${L.map(([x,f])=>{let w=x==="shell"&&(C.requires||[]).includes("werkbank");return t`<label title=${w?"Freigegeben durch \u201EBraucht die Werkbank\u201C":""}><input type="checkbox" ?disabled=${w} .checked=${w||(C.allow_write||[]).includes(x)}
            @change=${J=>{let p1=new Set(C.allow_write||[]);J.target.checked?p1.add(x):p1.delete(x),this.set("allow_write",[...p1])}}>${d(f.icon,16)} ${f.label}</label>`})}</div></div>
        <div class="card"><label class="row" style="gap:10px"><input type="checkbox" style="width:auto" .checked=${(C.requires||[]).includes("werkbank")}
            @change=${x=>this.set("requires",x.target.checked?["werkbank"]:[])}><b>Braucht die Werkbank</b></label>
          <div class="hint" style="margin:4px 0 8px">Für Schritte mit Befehlen, Python-Skripten, Office-Dateien oder Whisper. Gibt „Befehl ausführen“ frei. Ohne Werkbank läuft die Aufgabe nur teilweise.</div>
          ${(C.requires||[]).includes("werkbank")?t`<textarea rows="2" placeholder="Was geht ohne Werkbank nicht? (z. B. Sprachnachrichten abschreiben)" .value=${C.requires_note||""}
            @input=${x=>this.set("requires_note",x.target.value)}></textarea>`:s}</div>`)}
      </div>
      ${C.id?t`<h2>${a?"Bisherige Ergebnisse":p("L\xE4ufe")}</h2><div class="list">
        ${o?t`<div class="item">${d("wait",18)}<span class="grow ellipsis">Wartet in der Warteschlange (Platz ${o})</span></div>`:s}
        ${M.length?M.map(x=>t`<div class="item" @click=${()=>O(`/chat/${x.id}`)}>
        ${A.runs[x.id]||x.status==="running"?t`<lm-spark size="18"></lm-spark>`:d(x.status==="error"?"alert":"check",18)}<span class="grow ellipsis">${x.title}</span>
        <span class="hint">${a?D(x.updated):`${x.usage?.requests||0} Anfragen`}</span></div>`):o?s:t`<div class="hint">Noch keine Läufe.</div>`}</div>
        ${i.last_run?.summary?t`<h2>Letztes Ergebnis</h2><div class="card md">${T1(i.last_run.summary)}</div>`:s}
        ${C.shared?s:t`<div style="margin-top:24px"><button class="btn danger" @click=${async()=>{await v1(`Aufgabe \u201E${C.name}\u201C l\xF6schen? Die bisherigen L\xE4ufe bleiben als Chats erhalten.`)&&(await A.api.ws("task/delete",{task_id:C.id}),O("/tasks"))}}>${d("trash",16)} Aufgabe löschen</button></div>`}`:s}
      ${this.dirty?t`<div class="savebar fade-in">${C.id?t`<button class="btn" @click=${()=>this.reload()}>${p("Abbrechen")}</button>`:s}
        <button class="btn primary" @click=${this.save}>${d("check",16)} ${p("Speichern")}</button></div>`:s}
    </div>`}};_1.styles=[j,z2,B`.share { display: grid; gap: 8px; }
    .share .who { display: grid; grid-template-columns: minmax(0, 1fr) auto auto auto; gap: 8px; align-items: center; }
    .share .who .nm { overflow-wrap: anywhere; }
    .share .who label { display: flex; gap: 5px; align-items: center; font-size: 12.5px; color: var(--lm-muted); white-space: nowrap; }
    .share .who input[type=checkbox] { width: auto; }`],h([T()],_1.prototype,"taskId",2),h([k()],_1.prototype,"d",2),h([k()],_1.prototype,"preview",2),h([k()],_1.prototype,"dirty",2),h([k()],_1.prototype,"people",2),_1=h([F("lm-task")],_1);var S5=class extends e1{render(){let V=A.data?.skills||[];return t`<div class="page"><div class="row"><h1 class="grow">${p("Skills")}</h1>
      <button class="btn primary" @click=${()=>O("/skill/new")}>${d("plus",18)} ${p("Neuer Skill")}</button></div>
      ${E()?E2("skills",!V.length):t`
      <p class="hint">Skills sind Anleitungen für wiederkehrende Themen. Das Modell sieht Name und Beschreibung und lädt die ganze Anleitung, wenn sie passt.
        Zugangsdaten gehören nicht in den Skill-Text, sondern unter ${p("Zug\xE4nge")} – im Skill verweist du nur darauf.</p>`}
      <div class="list">${V.length?V.map(C=>t`<div class="item" @click=${()=>O(`/skill/${C.id}`)}>
        ${d("skill")}<div class="grow"><div class="ellipsis">${C.name}</div><div class="hint clamp2">${C.description}</div></div>
        ${(C.credentials||[]).length?t`<span class="chip">${d("key",13)} ${C.credentials.length}</span>`:s}
        ${C.enabled===!1?t`<span class="chip">aus</span>`:s}</div>`):t`<div class="hint">Noch keine Skills.</div>`}</div></div>`}};S5.styles=[j,z2],S5=h([F("lm-skills")],S5);var E1=class extends e1{constructor(){super(...arguments);this.skillId="";this.d=null;this.files=[];this.tab="edit";this.dirty=!1}updated(C){C.has("skillId")&&this.reload()}async reload(){let C=(A.data?.skills||[]).find(H=>H.id===this.skillId);this.d=C?JSON.parse(JSON.stringify(C)):{name:"",description:"",body:`# Anleitung

`,credentials:[],enabled:!0},this.dirty=!C,this.files=C?await A.api.ws("files",{scope:"skill",owner:C.id}):[]}set(C,H){this.d={...this.d,[C]:H},this.dirty=!0}async save(){try{let C=await A.api.ws("skill/save",{skill:this.d});this.dirty=!1,A.notify(p("Gespeichert")),await A.load(),this.skillId==="new"&&O(`/skill/${C.id}`,!0)}catch(C){A.notify(C.message)}}render(){let C=this.d;if(!C)return s;let H=E(),e=t`<div class="card"><b>${p("Zug\xE4nge")}, die dieser Skill nutzt</b><div class="chips" style="margin-top:8px">
          ${(A.data?.credentials||[]).map(L=>t`<button class=${(C.credentials||[]).includes(L.id)?"on":""}
            @click=${()=>{let i=new Set(C.credentials||[]);i.has(L.id)?i.delete(L.id):i.add(L.id),this.set("credentials",[...i])}}>${L.name}</button>`)}
          ${(A.data?.credentials||[]).length?s:t`<span class="hint">Noch keine Zugänge.</span>`}</div></div>
        ${C.id?t`<div class="card"><b>${p("Dateien")} (Skripte, Vorlagen, Referenzen)</b>
          ${this.files.map(L=>t`<div class="row" style="padding:4px 0"><span class="grow ellipsis" style="font-size:13px">${L.name}</span>
            <button class="iconbtn" @click=${async()=>window.open(await A.api.fileUrl("skill",C.id,L.name),"_blank")}>${d("download",16)}</button>
            <button class="iconbtn" @click=${async()=>{this.files=await A.api.ws("file/delete",{scope:"skill",owner:C.id,name:L.name})}}>${d("trash",16)}</button></div>`)}
          <label class="btn" style="margin-top:6px">${d("upload",16)} Hochladen<input type="file" multiple hidden @change=${async L=>{await A.api.upload("skill",C.id,L.target.files),this.files=await A.api.ws("files",{scope:"skill",owner:C.id}),L.target.value=""}}></label>
          <div class="hint" style="margin-top:6px">Skripte werden erst mit der Werkbank ausführbar; bis dahin kann das Modell sie lesen.</div></div>`:s}`;return t`<div class="page">
      <div class="row"><button class="iconbtn" @click=${()=>O("/skills")}>${d("left")}</button><h1 class="grow">${C.id?C.name:p("Neuer Skill")}</h1>
        ${b7(C.enabled!==!1,L=>this.set("enabled",L))}</div>
      <div class="form">
        <label class="f"><span>${p("Name")}</span><input .value=${C.name} @input=${L=>this.set("name",L.target.value)}></label>
        <label class="f"><span>${H?"Wann soll LLMitMir diese Anleitung benutzen?":t`${p("Beschreibung")} – wann soll der Skill benutzt werden?`}</span><textarea rows="3" .value=${C.description}
          @input=${L=>this.set("description",L.target.value)} placeholder="z. B. „Immer verwenden, wenn es um … geht, auch wenn … nicht ausdrücklich genannt wird.“"></textarea></label>
        ${H?t`<label class="f"><span>Anleitung – was soll LLMitMir dabei wissen und beachten?</span><textarea rows="14" .value=${C.body}
          placeholder="Schreib es so auf, als würdest du es einem neuen Kollegen erklären." @input=${L=>this.set("body",L.target.value)}></textarea>
          <span class="hint">Passwörter gehören nicht hierher, sondern unter ${p("Zug\xE4nge")}.</span></label>
          ${R2(e,"Mehr Optionen: Zug\xE4nge, Dateien")}`:t`
        <div><div class="row"><b class="grow">Anleitung (Markdown, wie SKILL.md)</b><div class="tabs">
          <button class=${this.tab==="edit"?"on":""} @click=${()=>this.tab="edit"}>Bearbeiten</button>
          <button class=${this.tab==="view"?"on":""} @click=${()=>this.tab="view"}>Vorschau</button></div></div>
          ${this.tab==="edit"?t`<textarea class="code" rows="22" style="margin-top:8px" .value=${C.body} @input=${L=>this.set("body",L.target.value)}></textarea>`:t`<div class="preview md" style="margin-top:8px">${T1(C.body)}</div>`}
          <div class="hint" style="margin-top:6px">Geheimnisse nie hineinschreiben. Verweise mit <code>{{cred:Name:feld}}</code> auf einen Zugang, z. B. <code>{{cred:Hof Nextcloud:password}}</code>.</div></div>
        ${e}`}
        ${C.id?t`<div><button class="btn danger" @click=${async()=>{await v1(`Skill \u201E${C.name}\u201C l\xF6schen?`)&&(await A.api.ws("skill/delete",{skill_id:C.id}),O("/skills"))}}>${d("trash",16)} Skill löschen</button></div>`:s}
      </div>
      ${this.dirty?t`<div class="savebar fade-in">${C.id?t`<button class="btn" @click=${()=>this.reload()}>${p("Abbrechen")}</button>`:s}
        <button class="btn primary" @click=${this.save}>${d("check",16)} ${p("Speichern")}</button></div>`:s}
    </div>`}};E1.styles=[j,z2,B`.chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .chips button { border: 1px solid var(--lm-line); background: var(--lm-panel); border-radius: 999px; padding: 4px 10px; font-size: 12.5px; cursor: pointer; max-width: 100%; overflow-wrap: anywhere; text-align: left; }
    .chips button.on { background: var(--lm-accent-soft); border-color: transparent; color: var(--lm-accent); }`],h([T()],E1.prototype,"skillId",2),h([k()],E1.prototype,"d",2),h([k()],E1.prototype,"files",2),h([k()],E1.prototype,"tab",2),h([k()],E1.prototype,"dirty",2),E1=h([F("lm-skill")],E1);var I9=r=>r.ext_uses_since??r.ext_uses??0;function uC(r){return r.uses?t`<span class="chip" title=${`Zuletzt ${D(r.last_used)}${r.last_model?` mit ${r.last_model}`:""}`}>${r.uses}× genutzt</span>`:s}function xC(r){if(!r.ext_uses&&!r.secret_changed)return s;let V=I9(r);return r.secret_changed?t`<span class="chip ${V?"warn":"ok"}" title=${`Geheimnis ge\xE4ndert ${D(r.secret_changed)} \xB7 insgesamt ${r.ext_uses||0}\xD7 extern genutzt`}>
    ${V?`seit \xC4nderung ${V}\xD7 extern genutzt`:"seit \xC4nderung nicht extern genutzt"}</span>`:t`<span class="chip warn" title=${`Zuletzt ${D(r.ext_last)}`}>${V}× extern genutzt</span>`}function hC(r){let V=r.expiry;if(!V?.date)return s;let C=V.date.split("-").reverse().join(".");return V.expired?t`<span class="chip err" title=${`Abgelaufen am ${C} \u2013 bitte erneuern`}>${d("alert",13)} abgelaufen</span>`:V.soon?t`<span class="chip warn" title=${`L\xE4uft am ${C} ab`}>${d("clock",13)} läuft am ${C} ab</span>`:t`<span class="chip" title=${`G\xFCltig bis ${C}`}>${d("clock",13)} bis ${C}</span>`}function ZC(r){let V=r.check;if(!V)return s;let C=`Zuletzt gepr\xFCft ${D(V.at)}`;return V.ok?t`<span class="chip ok" title=${`${C}: ${V.message}`}>${d("check",13)} geprüft</span>`:t`<span class="chip err" title=${`${C}: ${V.message}`}>${d("alert",13)} Prüfung fehlgeschlagen</span>`}function SC(r){let V=r.check;return V?t`${V.ok?"Zuletzt gepr\xFCft":"Zuletzt fehlgeschlagen"} ${D(V.at)}: <b>${V.message}</b>`:t`Noch nicht geprüft. Die Prüfung meldet sich mit einer harmlosen Leseanfrage an – sie liest nichts,
    ändert nichts und kostet nichts.`}function gC(r){return r.uses?t`Von Werkzeugen genutzt: <b>${r.uses}×</b>, zuletzt ${D(r.last_used)}${r.last_model?` mit ${r.last_model}`:""}.`:"Von Werkzeugen noch nicht genutzt."}function fC(r){let V=I9(r);if(r.secret_changed){let C=r.ext_uses_before??Math.max(0,(r.ext_uses||0)-V);return t`Passwort bzw. Token zuletzt geändert am ${D(r.secret_changed)}.
      ${V?t`Seitdem <b>${V}×</b> von externen Modellen genutzt, zuletzt ${D(r.ext_last)}.`:t`Seitdem <b>nicht</b> von externen Modellen genutzt.`}
      ${C?` Davor ${C}\xD7 \u2013 die alte Form ist durch die \xC4nderung ung\xFCltig.`:""}`}return r.ext_uses?t`Von externen Modellen genutzt: <b>${r.ext_uses}×</b>, zuletzt ${D(r.ext_last)}. Das Passwort selbst geht dabei nie hinaus;
    wer ganz sichergehen will, ändert es beim Dienst und trägt das neue hier ein – dann zählt LLMitMir neu.`:"Noch nie von einem externen Modell genutzt."}var D2=class extends e1{constructor(){super(...arguments);this.checking=!1}async checkAll(){this.checking=!0;try{await A.api.ws("credential/check_all"),await A.load()}catch(C){A.notify(C.message)}finally{this.checking=!1}}render(){let C=A.data?.credentials||[],H=A.data?.credential_types||{},e=!!(r1().configured||r1().has_access||C.some(M=>M.external||M.ext_uses)),L=M=>[...(A.data?.skills||[]).filter(o=>(o.credentials||[]).includes(M)).map(o=>o.name),...(A.data?.projects||[]).filter(o=>(o.credentials||[]).includes(M)).map(o=>o.name)],i=C.filter(M=>M.check&&!M.check.ok);return t`<div class="page"><div class="row"><h1 class="grow">${p("Zug\xE4nge")}</h1>
      ${C.length?t`<button class="btn" ?disabled=${this.checking} @click=${this.checkAll}>
        ${d("shield",18)} ${this.checking?p("Pr\xFCfe \u2026"):p("Alle pr\xFCfen")}</button>`:s}
      <button class="btn primary" @click=${()=>O("/credential/new")}>${d("plus",18)} ${p("Neuer Zugang")}</button></div>
      ${i.length?t`<div class="checkbox err" style="margin-bottom:14px">${d("alert",18)}
        <div><b>${i.length===1?"Ein Zugang funktioniert nicht":`${i.length} Zug\xE4nge funktionieren nicht`}:</b>
        ${i.map(M=>M.name).join(", ")}. Öffne den Zugang und trag das neue Passwort bzw. den neuen Token ein –
        sonst schlagen die Aufgaben fehl, die ihn brauchen.</div></div>`:s}
      ${E()?E2("credentials",!C.length):t`
      <div class="banner">${d("lock")}<div>Zugangsdaten liegen getrennt von Skills und Projekten. <b>Das Modell sieht nie ein Passwort oder Token</b> – es nennt nur den Namen
        des Zugangs, und die Werkzeuge setzen die Geheimnisse auf dem Server ein. Ergebnisse werden zusätzlich nach Geheimnissen durchsucht und geschwärzt.</div></div>`}
      <div class="list">${C.length?C.map(M=>t`<div class="item cred ${M.check&&!M.check.ok?"bad":""}" @click=${()=>O(`/credential/${M.id}`)}>
        ${d(M.check&&!M.check.ok?"alert":"key")}<div class="grow"><div class="ellipsis">${M.name}</div><div class="hint ellipsis">${H[M.type]?.label||M.type}${M.fields?.url?` \xB7 ${M.fields.url}`:""}${M.fields?.username?` \xB7 ${M.fields.username}`:""}</div>
        ${M.check&&!M.check.ok?t`<div class="cred-err">${M.check.message}</div>`:s}</div>
        <div class="tags">
        ${ZC(M)}
        ${e?M.external?t`<span class="chip warn" title="Für kostenpflichtige externe Modelle freigegeben">${d("euro",13)} extern frei</span>`:t`<span class="chip" title="Für kostenpflichtige externe Modelle gesperrt">${d("lock",13)} extern gesperrt</span>`:s}
        ${uC(M)}
        ${xC(M)}
        ${hC(M)}
        ${L(M.id).length?t`<span class="chip" title=${`Wird verwendet von: ${L(M.id).join(", ")}`}>${L(M.id).length}× verknüpft</span>`:s}</div></div>`):t`<div class="hint">Noch keine Zugänge.</div>`}</div></div>`}};D2.styles=[j,z2],h([k()],D2.prototype,"checking",2),D2=h([F("lm-credentials")],D2);var Z1=class extends e1{constructor(){super(...arguments);this.credId="";this.d=null;this.shown=new Set;this.revealed=null;this.dirty=!1;this.checking=!1;this.newField=""}updated(C){C.has("credId")&&this.reload()}reload(){let C=(A.data?.credentials||[]).find(H=>H.id===this.credId);this.d=C?JSON.parse(JSON.stringify(C)):{name:"",type:"webdav",fields:{},notes:""},this.revealed=null,this.shown=new Set,this.dirty=!C}set(C,H){this.d={...this.d,[C]:H},this.dirty=!0}setField(C,H){this.d={...this.d,fields:{...this.d.fields,[C]:H}},this.dirty=!0}async reveal(C){!this.revealed&&this.d.id&&(this.revealed=await A.api.ws("credential/reveal",{credential_id:this.d.id}));let H=new Set(this.shown);H.has(C)?H.delete(C):H.add(C),this.shown=H,this.revealed&&this.d.fields[C]==="\u2022\u2022\u2022"&&(this.d={...this.d,fields:{...this.d.fields,[C]:this.revealed.fields[C]}})}async save(){try{let C=await A.api.ws("credential/save",{credential:this.d});this.dirty=!1,A.notify(p("Gespeichert")),await A.load(),this.credId==="new"?O(`/credential/${C.id}`,!0):this.reload()}catch(C){A.notify(C.message)}}async check(){if(this.d?.id){this.checking=!0;try{let C=await A.api.ws("credential/check",{credential_id:this.d.id});this.d={...this.d,check:C},await A.load(),A.notify(C.ok?p("Zugang funktioniert"):C.message)}catch(C){A.notify(C.message)}finally{this.checking=!1}}}render(){let C=this.d;if(!C)return s;let H=A.data?.credential_types||{},e=H[C.type]||{fields:[],secret:[]},L=new Set([...e.secret||[],...C.secret_fields||[]]),i=e.services||{},M=C.services??e.default_services??[],o=e.service_fields||{},l=new Set([...Object.values(o).flat(),...e.obsolete||[]]),a=new Set(e.hidden||[]),m=[...e.fields,...Object.entries(o).filter(([f])=>M.includes(f)).flatMap(([,f])=>f)].filter(f=>!a.has(f)),c=[...m,...Object.keys(C.fields||{}).filter(f=>!m.includes(f)&&!l.has(f))],u=new Set(e.readonly||[]),b={url:"URL",username:"Benutzername",password:"Passwort",token:"Token",share_token:"Freigabe-Token",header:"Header-Name",key:"Schl\xFCssel",chat_ids:"Chat-IDs",imap_host:"IMAP-Server",smtp_host:"SMTP-Server",...e.labels||{}},x=e.placeholders||{};return t`<div class="page">
      <div class="row"><button class="iconbtn" @click=${()=>O("/credentials")}>${d("left")}</button><h1 class="grow">${C.id?C.name:p("Neuer Zugang")}</h1></div>
      <div class="form">
        <div class="two"><label class="f"><span>${p("Name")}</span><input .value=${C.name} placeholder="z. B. Hof Nextcloud" @input=${f=>this.set("name",f.target.value)}></label>
          <label class="f"><span>${p("Typ")}</span><select @change=${f=>{let w=H[f.target.value]||{};this.d={...this.d,type:f.target.value,services:w.services?this.d.services??w.default_services??[]:void 0,name:this.d.name||(f.target.value==="gwdg"?"GWDG-Exchange":f.target.value==="ews"?"Exchange":"")},this.dirty=!0}}>
            ${Object.entries(H).map(([f,w])=>t`<option value=${f} ?selected=${C.type===f}>${w.label}</option>`)}</select></label></div>
        ${e.hint?t`<div class="hint">${e.hint}</div>`:s}
        ${Object.keys(i).length?t`<div class="f"><span>${p("Verwenden f\xFCr")}</span>
          <div class="svcgrid">${Object.entries(i).map(([f,w])=>t`<label class="row" style="gap:6px;white-space:nowrap">
            <input type="checkbox" style="width:auto" .checked=${M.includes(f)} @change=${J=>this.set("services",Object.keys(i).filter(p1=>p1===f?J.target.checked:M.includes(p1)))}> ${w}</label>
            <select ?disabled=${!M.includes(f)} title="Was LLMitMir mit diesem Dienst darf"
              @change=${J=>this.set("access",{...C.access||{},[f]:J.target.value})}>
              <option value="read" ?selected=${(C.access?.[f]||"read")==="read"}>nur lesen</option>
              <option value="write" ?selected=${C.access?.[f]==="write"}>lesen und schreiben</option></select>`)}</div>
          <span class="hint">„Nur lesen“ gilt wirklich: Die KI bekommt das Passwort nie und kann dann weder Mails senden,
            verschieben oder löschen noch Termine oder Kontakte anlegen, ändern oder löschen.</span>
          ${M.length?s:t`<span class="hint" style="color:var(--lm-err)">Wähl mindestens einen Dienst aus.</span>`}</div>`:s}
        ${c.map(f=>t`<label class="f"><span>${b[f]||f}${L.has(f)?t` <span class="chip">${d("lock",12)} geheim</span>`:s}</span>
          <div class="fieldrow"><input type=${L.has(f)&&!this.shown.has(f)?"password":"text"} autocomplete="off" .value=${C.fields?.[f]??""}
            placeholder=${x[f]||(u.has(f)?"Wird beim Speichern automatisch erg\xE4nzt":"")} ?readonly=${u.has(f)}
            @focus=${w=>{w.target.value==="\u2022\u2022\u2022"&&(w.target.value="")}} @input=${w=>this.setField(f,w.target.value)}>
            ${L.has(f)?t`<button class="iconbtn" title=${this.shown.has(f)?p("Verbergen"):p("Anzeigen")} @click=${()=>this.reveal(f)}>${d(this.shown.has(f)?"eyeOff":"eye",18)}</button>`:s}
            ${C.id&&C.fields?.[f]?t`<button class="iconbtn" title=${p("Kopieren")} @click=${async()=>{let w=L.has(f)?(this.revealed||await A.api.ws("credential/reveal",{credential_id:C.id})).fields[f]:C.fields[f];A2(w)}}>${d("copy",18)}</button>`:s}
            ${m.includes(f)?s:t`<button class="iconbtn" title="Feld entfernen" @click=${()=>{let w={...C.fields};delete w[f],this.d={...C,fields:w,remove_fields:[...C.remove_fields||[],f]},this.dirty=!0}}>${d("trash",18)}</button>`}</div></label>`)}
        ${(E()?f=>R2(f,"Weiteres Feld hinzuf\xFCgen"):f=>f)(t`<div class="row"><input placeholder="Weiteres Feld (Name)" .value=${this.newField} @input=${f=>this.newField=f.target.value}>
          <button class="btn" @click=${()=>{this.newField.trim()&&(this.setField(this.newField.trim().replace(/\W+/g,"_"),""),this.newField="")}}>${d("plus",16)} Feld</button>
          <label class="row hint" style="white-space:nowrap"><input type="checkbox" style="width:auto" @change=${f=>{if(!this.newField.trim())return;let w=this.newField.trim().replace(/\W+/g,"_");this.set("secret_fields",f.target.checked?[...C.secret_fields||[],w]:(C.secret_fields||[]).filter(J=>J!==w))}}> geheim</label></div>`)}
        <label class="f"><span>${p("G\xFCltig bis")} <span class="hint">(optional)</span></span>
          <input type="date" .value=${C.valid_until||""} @input=${f=>this.set("valid_until",f.target.value)}>
          <span class="hint">Viele Tokens laufen ab. LLMitMir warnt zwei Wochen vorher in der Liste und nennt den Grund, wenn ein Werkzeug deshalb scheitert.</span></label>
        <label class="f"><span>${p("Notiz")}</span><textarea rows="3" placeholder="Wofür, wo erneuern …" .value=${C.notes||""} @input=${f=>this.set("notes",f.target.value)}></textarea></label>
        ${C.id?t`<div class="card"><b>${d("shield",16)} ${p("Funktionieren die Zugangsdaten?")}</b>
          <div class="checkbox ${C.check?C.check.ok?"ok":"err":""}" style="margin-top:8px">
            ${d(C.check&&!C.check.ok?"alert":C.check?"check":"info",18)}<div>${SC(C)}</div></div>
          <div class="row" style="margin-top:10px"><button class="btn" ?disabled=${this.checking} @click=${this.check}>
            ${d("shield",16)} ${this.checking?p("Pr\xFCfe \u2026"):p("Jetzt pr\xFCfen")}</button>
            <span class="hint">Meldet sich mit einer Leseanfrage an, ändert nichts.</span></div></div>`:s}
        ${C.id?t`<div class="hint">${gC(C)}</div>`:s}
        ${r1().configured||r1().has_access||C.external||C.ext_uses?t`<div class="card"><b>${d("euro",16)} Kostenpflichtige externe Modelle</b>
          <div class="form" style="margin-top:8px;gap:8px">
            <label class="row" style="gap:10px;align-items:flex-start"><input type="radio" name="extcred" style="width:auto;margin-top:3px" .checked=${!C.external}
              @change=${()=>this.set("external",!1)}><span><b>Gesperrt</b> (Standard)<br><span class="hint">Externe Modelle (Claude bei Microsoft Azure oder Anthropic)
              sehen diesen Zugang gar nicht, können ihn nicht nutzen, und frühere Ergebnisse aus ihm werden aus dem Verlauf entfernt.</span></span></label>
            <label class="row" style="gap:10px;align-items:flex-start"><input type="radio" name="extcred" style="width:auto;margin-top:3px" .checked=${!!C.external}
              @change=${()=>this.set("external",!0)}><span><b>Freigegeben</b><br><span class="hint">Externe Modelle dürfen ihn nutzen; was sie damit abrufen
              (z. B. Dateien, Termine), geht an den externen Anbieter. Das Passwort selbst bekommt nie ein Modell zu sehen. Nur für Zugänge ohne sensible Inhalte.</span></span></label>
            <div class="hint">${fC(C)}</div>
          </div></div>`:s}
        ${E()?t`<div class="hint">${d("lock",15)} Deine Passwörter sieht die KI nie – LLMitMir setzt sie erst beim Zugriff im Hintergrund ein.</div>`:s}
        ${C.id&&!E()?t`<div class="card hint">Im Skill oder Auftrag verweisen: <code>{{cred:${C.name}:${e.secret?.[0]||"feld"}}}</code> – oder in Werkzeugen <code>zugang: "${C.name}"</code>.</div>`:s}
        ${C.id?t`<div><button class="btn danger" @click=${async()=>{await v1(`Zugang \u201E${C.name}\u201C l\xF6schen? Skills und Projekte verlieren den Verweis.`)&&(await A.api.ws("credential/delete",{credential_id:C.id}),O("/credentials"))}}>${d("trash",16)} Zugang löschen</button></div>`:s}
      </div>
      ${this.dirty?t`<div class="savebar fade-in">${C.id?t`<button class="btn" @click=${()=>this.reload()}>${p("Abbrechen")}</button>`:s}
        <button class="btn primary" @click=${this.save}>${d("check",16)} ${p("Speichern")}</button></div>`:s}
    </div>`}};Z1.styles=[j,z2,B`.fieldrow { display: flex; gap: 6px; align-items: center; } .fieldrow input { flex: 1; font-family: var(--lm-mono); font-size: 13.5px; } .svcgrid { display: grid; grid-template-columns: max-content minmax(0, 220px); gap: 8px 16px; align-items: center; }`],h([T()],Z1.prototype,"credId",2),h([k()],Z1.prototype,"d",2),h([k()],Z1.prototype,"shown",2),h([k()],Z1.prototype,"revealed",2),h([k()],Z1.prototype,"dirty",2),h([k()],Z1.prototype,"checking",2),h([k()],Z1.prototype,"newField",2),Z1=h([F("lm-credential")],Z1);function W9(r){return`Bitte \xFCbertrage meine Inhalte aus diesem Claude-Konto nach \u201ELLMitMir\u201C in meinem Home Assistant.
Ziel-URL (Einmal-Link, 24 h g\xFCltig, nimmt genau ein JSON per HTTP-POST entgegen):
${r}

Sammle alles, worauf du mit deinen Werkzeugen zugreifen kannst, und baue daraus EIN JSON-Objekt nach diesem Schema:

{
  "source": "claude",
  "memory": "<alles, was du dauerhaft \xFCber mich wei\xDFt: Erinnerungen, pers\xF6nliche Einstellungen, Vorlieben, Hinweise aus Memory-Dateien \u2013 als Flie\xDFtext oder Stichpunkte>",
  "credentials": [
    {"name": "<sprechender Name, eindeutig>", "type": "webdav|basic|bearer|header|telegram|imap|ews|gwdg|other",
     "fields": {"url": "...", "username": "...", "password": "...", "token": "...", "share_token": "...", "chat_ids": "..."},
     "services": ["<nur bei type gwdg (GWDG-Exchange, fields nur username = GWDG-E-Mail und password) und type ews: mail, calendar und/oder contacts>"],
     "access": {"<nur bei type gwdg und ews, je Dienst>": "read|write"},
     "notes": "<wof\xFCr, G\xFCltigkeit/Ablaufdatum, Hinweise>", "secret_fields": ["<nur bei type other: welche Felder geheim sind>"]}
  ],
  "skills": [
    {"name": "...", "description": "<die Beschreibung aus dem Frontmatter, wann der Skill gilt>",
     "body": "<vollst\xE4ndiger Inhalt der SKILL.md ohne Frontmatter, Geheimnisse ersetzt durch {{cred:<Name>:<feld>}}>",
     "credentials": ["<Namen der Zug\xE4nge, die der Skill nutzt>"],
     "files": [{"name": "<relativer Pfad, z. B. scripts/ha.py>", "content": "<Textinhalt>"}]}
  ],
  "projects": [
    {"name": "...", "description": "...", "instructions": "<Projektanweisungen>", "credentials": ["..."], "skills": ["..."],
     "files": [{"name": "...", "content": "<Text>"}]}
  ],
  "tasks": [
    {"name": "...", "prompt": "<vollst\xE4ndiger Auftrag der geplanten Aufgabe>",
     "schedule": {"type": "cron", "cron": "<5 Felder: Minute Stunde Tag Monat Wochentag, Ortszeit Europe/Berlin>"},
     "project": "<Projektname oder leer>", "allow_write": [], "note": "<Modell, Zeitzone, Besonderheiten>"}
  ]
}

So gehst du vor:
1. Skills: Liste alle Skills, die dir zur Verf\xFCgung stehen (auch eigene/synchronisierte). Lies jede SKILL.md vollst\xE4ndig und dazugeh\xF6rige Textdateien (Skripte, Vorlagen; Bin\xE4rdateien weglassen, je Datei h\xF6chstens 200 KB).
2. Zugangsdaten herausl\xF6sen: Alle URLs mit Benutzername/Passwort, App-Passw\xF6rter, API-Tokens, Bot-Tokens, Freigabe-Links mit Passwort usw. aus Skills, Projekten und Aufgaben werden je Dienst zu einem Eintrag in "credentials" (gleiche Zugangsdaten nur einmal). Im Text ersetzt du das Geheimnis durch {{cred:<Name>:<feld>}} und tr\xE4gst den Namen in "credentials" des Skills/Projekts ein. Nichts weglassen \u2013 ich will die Zugangsdaten in LLMitMir separat sehen und verwalten.
3. Geplante Aufgaben: Liste alle geplanten Aufgaben/Routinen (z. B. \xFCber list_triggers bzw. RemoteTrigger \u201Elist\u201C, alle Seiten mit next_cursor). \xDCbernimm Name, vollst\xE4ndigen Prompt und Zeitplan; entferne ein \u201ECRON_TZ=\u2026\u201C-Pr\xE4fix und rechne den Zeitplan in Ortszeit Europe/Berlin um, falls er in UTC angegeben ist. Ersetze Geheimnisse wie in Schritt 2. Verweist eine Aufgabe auf Claude-spezifische Werkzeuge (z. B. Gmail-Connector, list_triggers), vermerke das in "note".
4. Projekte: \xDCbernimm Projekte mit Anweisungen und Textdateien, soweit du darauf zugreifen kannst. Kommst du nicht heran, lass "projects" leer und sag es mir.
5. Erinnerungen: Fasse in "memory" zusammen, was du dauerhaft \xFCber mich wei\xDFt (Memory-Funktion, Memory-Dateien, CLAUDE.md, pers\xF6nliche Pr\xE4ferenzen). Keine Inhalte einzelner Chats.
6. Sende das JSON per HTTP-POST an die Ziel-URL (Content-Type: application/json), z. B. mit curl:
   curl -sS -X POST -H 'Content-Type: application/json' --data-binary @llmitmir-import.json '${r}'
   Ist das JSON gr\xF6\xDFer als 50 MB, teile es in mehrere POSTs mit denselben Schl\xFCsseln auf (der Link nimmt dann nur den ersten an \u2013 in dem Fall schreibe mir die Datei stattdessen, siehe 7).
7. Hast du keinen Netzwerkzugriff oder schl\xE4gt der POST fehl: Speichere das JSON als Datei \u201Ellmitmir-import.json\u201C und gib sie mir zum Herunterladen; ich lade sie in LLMitMir unter Einstellungen \u2192 Import hoch.
8. Antworte mir am Ende kurz: wie viele Skills, Zug\xE4nge, Aufgaben, Projekte \xFCbertragen wurden, was du nicht \xFCbertragen konntest und warum. Gib dabei KEINE Geheimnisse im Chat aus.

Hinweis: Chatverl\xE4ufe kannst du nicht auslesen \u2013 die \xFCbernehme ich separat \xFCber den offiziellen Datenexport von claude.ai (Einstellungen \u2192 Datenschutz \u2192 Daten exportieren), den ich als ZIP in LLMitMir hochlade. Importierte Aufgaben sind in LLMitMir zun\xE4chst pausiert, damit ich sie pr\xFCfen kann.`}var j9=`# Die Werkbank einrichten

Die **Werkbank** ist eine optionale Erg\xE4nzung f\xFCr LLMitMir: ein kleiner Rechner (meist eine virtuelle Maschine), auf dem die
Modelle **Programme ausf\xFChren** d\xFCrfen \u2013 abgeschottet von Home Assistant. LLMitMir funktioniert auch ohne Werkbank.

## Was bringt die Werkbank?

| | Ohne Werkbank | Mit Werkbank |
|---|---|---|
| Chatten, Coworks, geplante Aufgaben | \u2713 | \u2713 |
| Web durchsuchen, Seiten abrufen | \u2713 | \u2713 |
| Home Assistant lesen und steuern | \u2713 | \u2713 |
| Nextcloud-Dateien, -Kalender, -Kontakte | \u2713 | \u2713 |
| PDFs, Scans und Fotos lesen (Bildmodell) | \u2713 | \u2713 |
| **Python-Skripte und Befehle ausf\xFChren** (z. B. Skripte aus Skills) | \u2013 | \u2713 |
| **Rechnen und Auswerten** mit pandas, Tabellen und Diagramme erzeugen | \u2013 | \u2713 |
| **Excel, Word, PowerPoint, PDF** erstellen oder umbauen | \u2013 | \u2713 |
| **Sprachnachrichten abschreiben** (Whisper), Audio/Video umwandeln (ffmpeg) | \u2013 | \u2713 |
| **Texterkennung** (Tesseract) als Erg\xE4nzung zum Bildmodell | \u2013 | \u2713 |
| Beliebige Kommandozeilen-Werkzeuge (curl, git, jq, sqlite \u2026) | \u2013 | \u2713 |

Jeder Chat und jede Aufgabe bekommt auf der Werkbank eine **eigene Sandbox** (einen abgeschotteten Container) mit eigenem
Arbeitsordner. Anh\xE4nge und Skill-Dateien werden dort hineinkopiert, Ergebnisse holt das Modell zur\xFCck in den Chat. Ungenutzte
Sandboxen r\xE4umt die Werkbank nach zwei Stunden auf. Befehle laufen wie andere schreibende Aktionen nur mit deiner Freigabe.

## Was du brauchst

- **Einen Rechner oder eine VM**, die dauerhaft l\xE4uft, mit **Debian 12/13** oder **Ubuntu 22.04/24.04** (64 Bit, x86 oder ARM).
  Am einfachsten ist eine neue VM auf demselben Server wie Home Assistant (z. B. Proxmox). Ein Raspberry Pi 5 mit 8 GB geht auch, ist aber langsamer.
- **Leistung:**

  | | Mindestens | Empfohlen |
  |---|---|---|
  | Prozessor | 2 Kerne | 4 Kerne |
  | Arbeitsspeicher | 4 GB | 8 GB (Whisper braucht beim Abschreiben ~3 GB) |
  | Festplatte | 25 GB | 50 GB (Programme ~8 GB, Sprachmodelle, Arbeitsordner) |

- **Netzwerk:** Home Assistant muss die Werkbank erreichen (Port **8787**), und die Werkbank braucht Internet
  (f\xFCr Webseiten, Python-Pakete und das Herunterladen des Sprachmodells). Gib ihr im Router eine **feste IP-Adresse**.
- **Nicht n\xF6tig:** Freigabe ins Internet, Portweiterleitung, eigene Domain. Die Werkbank bleibt im Heimnetz.

## Einrichten in 4 Schritten

### 1. VM anlegen

Beispiel Proxmox: *VM erstellen* \u2192 Name z. B. \`werkbank\` \u2192 ISO von Debian 13 (netinst) \u2192 Festplatte 50 GB \u2192 4 Kerne \u2192
8192 MB RAM \u2192 Netzwerk wie Home Assistant (Bridge \`vmbr0\`). Debian installieren und dabei **\u201ESSH-Server\u201C** anhaken;
eine Desktop-Umgebung ist nicht n\xF6tig. Bei anderen Systemen (VirtualBox, Synology VMM, Unraid \u2026) entsprechend.

### 2. Werkbank installieren

Melde dich auf der VM an (Konsole in Proxmox oder per SSH), werde root und f\xFChre **einen** Befehl aus:

\`\`\`bash
sudo -i
curl -fsSL https://git.unfoobar.org/ha-integrations/llmitmir/-/raw/main/werkbank/install.sh | bash
\`\`\`

Das Skript installiert Docker, l\xE4dt die Werkbank, erzeugt einen geheimen Schl\xFCssel (Token), baut die Sandbox
(beim ersten Mal 5\u201315 Minuten) und startet alles. Am Ende stehen **URL** und **Token** auf dem Bildschirm, z. B.:

\`\`\`
URL:    http://192.168.1.50:8787
Token:  3f9c\u2026e21a
\`\`\`

### 3. In Home Assistant eintragen

\xD6ffne in Home Assistant **LLMitMir \u2192 Admin \u2192 Werkbank**, trage URL und Token ein, klicke **Verbindung testen** und dann
**Speichern**. Steht dort \u201Everbunden\u201C, ist alles fertig.

### 4. Ausprobieren

Starte ein **Cowork** und schreibe z. B.: *\u201EErzeuge mit Python ein Diagramm der Zahlen 3, 7, 4, 9 und speichere es als
diagramm.png.\u201C* Das Modell fragt vor dem ersten Befehl nach deiner Freigabe.

## Sicherheit

- Nutze f\xFCr die Werkbank eine **eigene VM**, auf der sonst nichts l\xE4uft: Der Werkbank-Dienst steuert Docker und hat damit
  volle Rechte auf dieser VM.
- Die Sandboxen laufen ohne Sonderrechte, mit begrenztem Speicher (3 GB), Prozessor (2 Kerne) und Prozessanzahl. Sie haben
  Internetzugang (\`SANDBOX_NETWORK=bridge\`); mit \`none\` laufen sie komplett offline \u2013 dann gehen aber keine Downloads.
- Der **Token** ist das einzige Passwort \u2013 nicht weitergeben. Erlaube Port 8787 am besten nur f\xFCr die IP von Home Assistant
  (Firewall der VM oder des Routers).
- Gib die Werkbank **nicht ins Internet frei**.
- Zugangsdaten aus LLMitMir landen nur dann in einer Sandbox, wenn ein Befehl sie \xFCber \`{{cred:Name:feld}}\` anfordert;
  Ausgaben werden wie \xFCberall nach Geheimnissen durchsucht und geschw\xE4rzt.

## Betrieb

| Was | Befehl (auf der VM als root) |
|---|---|
| Aktualisieren | den Installationsbefehl aus Schritt 2 noch einmal ausf\xFChren |
| Token anzeigen | \`grep WERKBANK_TOKEN /opt/llmitmir-werkbank/werkbank/.env\` |
| Log ansehen | \`cd /opt/llmitmir-werkbank/werkbank && docker compose logs --tail 100\` |
| Neu starten | \`cd /opt/llmitmir-werkbank/werkbank && docker compose restart\` |
| Laufende Sandboxen | \`docker ps --filter label=llmitmir.werkbank=1\` |
| Einstellungen \xE4ndern | \`/opt/llmitmir-werkbank/werkbank/.env\` bearbeiten, dann \`docker compose up -d\` |
| Entfernen | \`cd /opt/llmitmir-werkbank/werkbank && docker compose down && docker rm -f $(docker ps -aq --filter label=llmitmir.werkbank=1); rm -rf /opt/llmitmir-werkbank\` |

## Wenn etwas nicht klappt

- **\u201EVerbindung testen\u201C schl\xE4gt fehl:** L\xE4uft die VM? Stimmt die IP (\`hostname -I\` auf der VM)? L\xE4sst eine Firewall Port 8787
  durch? Von einem anderen Rechner im Netz testen: \`curl -H "Authorization: Bearer <Token>" http://<IP>:8787/v1/health\`.
- **\u201E401 Token fehlt oder falsch\u201C:** Token in Home Assistant neu einf\xFCgen (ohne Leerzeichen am Anfang/Ende).
- **\u201Esandbox_image_ready: false\u201C:** Das Sandbox-Image fehlt \u2013 Installationsbefehl erneut ausf\xFChren.
- **Befehle brechen ab:** Speicher knapp? \`SANDBOX_MEMORY\` in \`.env\` erh\xF6hen (und der VM mehr RAM geben).

---

## F\xFCr Fortgeschrittene

**Aufbau:** \`werkbank/server.py\` ist ein kleiner aiohttp-Dienst im Container \`llmitmir-werkbank\`. Er spricht \xFCber
\`/var/run/docker.sock\` mit Docker und startet je Sitzung (LLMitMir nutzt die Chat-ID) einen Container \`lmwb-<id>\` aus dem
Image \`llmitmir-werkbank-sandbox\` (Python 3.13, ffmpeg, Tesseract, Poppler, ImageMagick, Node.js, pandas, faster-whisper \u2026),
Benutzer \`agent\` (UID 1000), Arbeitsordner \`/workspace\`, gemeinsamer Cache \`/cache\` (Volume \`llmitmir-werkbank-cache\` f\xFCr
pip und Sprachmodelle).

**Einstellungen** (\`werkbank/.env\`): \`WERKBANK_TOKEN\`, \`WERKBANK_PORT\` (8787), \`SANDBOX_MEMORY\` (3g), \`SANDBOX_CPUS\` (2),
\`SANDBOX_PIDS\` (512), \`SANDBOX_NETWORK\` (bridge|none), \`MAX_SESSIONS\` (6), \`IDLE_TIMEOUT\` (7200 s), \`MAX_EXEC_TIMEOUT\`
(3600 s), \`SANDBOX_IMAGE\`, \`TZ\`.

**API** (alle mit \`Authorization: Bearer <Token>\`):

| Methode | Pfad | Zweck |
|---|---|---|
| GET | \`/v1/health\` | Version, Grenzen, Sandbox-Image bereit, laufende Sitzungen |
| POST | \`/v1/sessions/{id}\` | Sandbox anlegen bzw. fortsetzen |
| POST | \`/v1/sessions/{id}/exec\` | \`{"cmd": "...", "timeout": 120, "workdir": "/workspace"}\` \u2192 Exit-Code, stdout, stderr |
| GET / PUT | \`/v1/sessions/{id}/files?path=\u2026\` | Datei holen / ablegen (unter \`/workspace\` oder \`/tmp\`) |
| GET | \`/v1/sessions/{id}/list?path=\u2026\` | Ordner auflisten |
| DELETE | \`/v1/sessions/{id}\` | Sandbox entfernen |

**Mit Ansible/Compose verwalten:** Repository in einer festen Version auschecken, \`werkbank/.env\` aus einer Vorlage
erzeugen (Token aus dem Vault), \`docker build -t llmitmir-werkbank-sandbox:latest werkbank/sandbox\` und
\`docker compose up -d --build\` im Ordner \`werkbank/\` ausf\xFChren \u2013 genau das, was \`install.sh\` macht.
`;var U9=B`:host { display: block; height: 100%; overflow-y: auto; }
  section { margin-bottom: 26px; } section > h2 { display: flex; gap: 8px; align-items: center; }
  .form { display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; } .two { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px; }
  .savebar { position: sticky; bottom: 12px; display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px; }
  .bars { display: flex; align-items: flex-end; gap: 3px; height: 120px; padding-top: 10px; }
  .bars div { flex: 1; background: var(--lm-accent); border-radius: 3px 3px 0 0; min-height: 2px; opacity: .85; position: relative; transition: height .4s; }
  .bars div:hover { opacity: 1; }
  .opt { display: flex; gap: 10px; align-items: flex-start; padding: 12px; border: 1px solid var(--lm-line); border-radius: 12px; cursor: pointer; background: var(--lm-panel); }
  .opt.on { border-color: var(--lm-accent); box-shadow: 0 0 0 3px var(--lm-accent-soft); }
  .opt input { width: auto; margin-top: 3px; }
  table { width: 100%; border-collapse: collapse; font-size: 13.5px; } td, th { padding: 8px 6px; border-bottom: 1px solid var(--lm-line); text-align: left; vertical-align: middle; }
  th { font-weight: 600; color: var(--lm-muted); font-size: 12px; }
  td input { padding: 6px 8px; } td input[type=checkbox] { width: auto; }
  .prompt { font-family: var(--lm-mono); font-size: 12px; white-space: pre-wrap; max-height: 260px; overflow-y: auto; background: var(--lm-side);
    border: 1px solid var(--lm-line); border-radius: 10px; padding: 12px; }
  .tw { overflow-x: auto; }
  .wbgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 10px 0; }
  .wbgrid ul { margin: 6px 0 0; padding-left: 1.2em; } .wbgrid li { margin: 3px 0; font-size: 13.5px; }
  .guide { margin-top: 12px; max-height: 70vh; overflow-y: auto; }
  .status { display: inline-flex; align-items: center; gap: 6px; }
  .prov { display: grid; gap: 10px; }
  .prov .card { display: grid; gap: 10px; }
  .prov .head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .prov .pos { width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; background: var(--lm-accent-soft); color: var(--lm-accent); font-weight: 600; font-size: 13px; flex: none; }
  .prov .off { opacity: .6; }
  .mbars { display: flex; align-items: flex-end; gap: 2px; height: 34px; min-width: 120px; }
  .mbars div { flex: 1; background: var(--lm-accent); border-radius: 2px 2px 0 0; min-height: 1px; opacity: .8; }
  td.num, th.num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .matrix td, .matrix th { text-align: center; } .matrix td:first-child, .matrix th:first-child { text-align: left; }
  @media (max-width: 640px) { .wbgrid { grid-template-columns: 1fr; } }
  @media (max-width: 640px) { .two { grid-template-columns: 1fr; } }`;function G9(r,V,C,H){return t`<div class="card">
    <div class="row"><b class="grow">LLMitMir funktioniert mit und ohne Werkbank</b>
      ${r?t`<span class="chip ok">${d("check",13)} eingerichtet</span>`:t`<span class="chip">nicht eingerichtet</span>`}</div>
    <p class="hint" style="margin:6px 0 0">Die Werkbank ist ein eigener kleiner Rechner (meist eine VM), auf dem die Modelle Programme ausführen dürfen –
      abgeschottet von Home Assistant, für jeden Chat in einer eigenen Sandbox.</p>
    <div class="wbgrid">
      <div><b style="font-size:13.5px">Ohne Werkbank geht</b><ul>
        <li>Chatten, Coworks und geplante Aufgaben</li><li>Web durchsuchen und Seiten abrufen</li>
        <li>Home Assistant lesen und steuern</li><li>Nextcloud-Dateien, -Kalender und -Kontakte</li><li>PDFs, Scans und Fotos lesen</li></ul></div>
      <div><b style="font-size:13.5px">Nur mit Werkbank</b><ul>
        <li>Python-Skripte und Befehle ausführen, auch Skripte aus Skills</li><li>Auswerten und rechnen, Diagramme erzeugen</li>
        <li>Excel-, Word-, PowerPoint- und PDF-Dateien erstellen</li><li>Sprachnachrichten abschreiben (Whisper), Audio/Video umwandeln</li>
        <li>Texterkennung (Tesseract) und Werkzeuge wie curl, git, jq</li></ul></div></div>
    <div class="row" style="flex-wrap:wrap">
      <button class="btn" @click=${C}>${d(V?"down":"right",16)} Anleitung zur Einrichtung ${V?"ausblenden":"anzeigen"}</button>
      ${!H&&!r?t`<span class="hint">Einrichten kann nur ein Admin von Home Assistant.</span>`:s}</div>
    ${V?t`<div class="guide md card fade-in">${T1(j9,{breaks:!1})}</div>`:s}
  </div>`}var a1=class extends e1{constructor(){super(...arguments);this.s={};this.memory="";this.dirty=!1;this.devices=[];this.deviceSel="";this.devicesLoaded=!1;this.history=null;this.imp=null;this.impResult=null;this.guide=!1;this.impBusy=""}connectedCallback(){super.connectedCallback(),this.reset(),A.api.ws("notify_devices").then(C=>{this.devices=C.devices||[],this.deviceSel=C.selected||"",this.devicesLoaded=!0}),A.api.ws("usage/history").then(C=>this.history=C)}reset(){this.s={...A.data?.settings||{}},this.memory=A.data?.memory||"",this.dirty=!1,this.deviceSel=this.s.notify_device||""}set(C,H){this.s={...this.s,[C]:H},this.dirty=!0}async save(){let C={...this.s,memory:this.memory};delete C.has_own_key,delete C.has_own_task_key,C.own_key||delete C.own_key,C.own_task_key||delete C.own_task_key,["user","own"].includes(A.data?.usage?.tasks?.mode||"")||delete C.task_key_choice,A.data?.view?.locked&&delete C.view,delete C.notify_service,C.notify_device=this.deviceSel;try{await A.api.ws("settings/save",{settings:C})}catch(H){A.notify(H.message);return}this.dirty=!1,A.notify(p("Gespeichert")),await A.load(),this.reset(),A.api.ws("usage/history").then(H=>this.history=H)}async newImport(){let C=await A.api.ws("import/token"),H=`${location.origin}${C.path}`;this.imp={url:H,prompt:W9(H),expires:C.expires}}async uploadImport(C){let H=Array.from(C.target.files||[]);if(C.target.value="",!H.length)return;let e={chats:0,projects:0,skills:0,credentials:0,tasks:0,skipped:0,files:[]};for(let[L,i]of H.entries()){this.impBusy=`${L+1}/${H.length}: ${i.name} wird hochgeladen \u2026`;try{let M=await A.api.uploadImport(i,(o,l)=>{this.impBusy=`${L+1}/${H.length}: ${i.name} \u2013 ${Math.round(100*o/l)} %${o>=l?" \xB7 wird verarbeitet \u2026":""}`});for(let o of["chats","projects","skills","credentials","tasks","skipped"])e[o]+=M[o]||0;e.files.push({name:i.name,error:M.error,info:M.info,found:M.found})}catch(M){e.files.push({name:i.name,error:M.message})}}this.impBusy="",this.impResult=e,await A.load(),A.notify("Import abgeschlossen")}inboxSection(){let C=this.s,H=C.inbox_mode||"auto",e=Number(C.inbox_minutes??30),L=C.inbox_muted||[],i=A.data?.chats||[],M=l=>i.find(a=>a.id===l)?.title||l,o=[["auto","Automatisch","An, solange kein Push-Ger\xE4t gew\xE4hlt ist \u2013 so bekommst du die Ergebnisse geplanter Aufgaben auf jeden Fall mit."],["on","Immer an","Auch wenn Push-Nachrichten ankommen: die Ergebnisse stehen zus\xE4tzlich auf der Startseite."],["off","Aus","Keine Benachrichtigungen auf der Startseite."]];return t`<div class="sub">
      <div class="row" style="align-items:center;gap:8px;margin-top:14px">${d("bell",16)}<b class="grow">Auf der Startseite anzeigen</b></div>
      <div class="hint">Ergebnisse geplanter Aufgaben erscheinen als Karten auf der Startseite – wie Benachrichtigungen auf dem Handy.
        Kurz tippen öffnet den Chat, lange drücken schaltet den Chat stumm, „×“ oder Wischen entfernt die Karte.</div>
      <label class="f" style="margin-top:10px"><span>Anzeige</span>
        <select @change=${l=>this.set("inbox_mode",l.target.value)}>
          ${o.map(([l,a])=>t`<option value=${l} ?selected=${H===l}>${a}</option>`)}
        </select></label>
      <div class="hint">${o.find(([l])=>l===H)?.[2]||""}</div>
      ${H==="off"?s:t`<label class="f" style="margin-top:10px"><span>Anzeigedauer</span>
        <select @change=${l=>this.set("inbox_minutes",Number(l.target.value))}>
          ${[[0,"Bleibt stehen, bis ich sie entferne"],[5,"5 Minuten"],[15,"15 Minuten"],[30,"30 Minuten"],[60,"1 Stunde"],[180,"3 Stunden"],[720,"12 Stunden"],[1440,"1 Tag"]].map(([l,a])=>t`<option value=${l} ?selected=${e===l}>${a}</option>`)}
          ${[0,5,15,30,60,180,720,1440].includes(e)?s:t`<option value=${e} selected>${e} Minuten</option>`}
        </select></label>
        <div class="hint">Danach verschwindet die Karte von selbst. „Bleibt stehen“ heißt: nur du entfernst sie.</div>`}
      ${L.length?t`<div style="margin-top:12px"><div class="hint">Stumm geschaltete Chats</div>
        ${L.map(l=>t`<div class="row" style="padding:4px 0"><span class="grow ellipsis">${M(l)}</span>
          <button class="btn ghost" @click=${()=>this.set("inbox_muted",L.filter(a=>a!==l))}>${d("bell",15)} wieder an</button></div>`)}
      </div>`:s}
    </div>`}taskKeySection(){let C=A.data?.usage?.tasks,H=this.s;if(!C||C.mode==="same")return s;if(C.mode==="shared")return t`<section><h2>${d("task",18)} Schlüssel für geplante Aufgaben</h2>
      <div class="hint">${C.has_central?"Deine geplanten Aufgaben laufen \xFCber den zentralen Aufgaben-Schl\xFCssel, den der Admin eingetragen hat. Chats und Coworks behalten so ihr volles Kontingent.":"Der Admin hat einen zentralen Aufgaben-Schl\xFCssel vorgesehen, aber noch nicht eingetragen \u2013 bis dahin laufen Aufgaben \xFCber den normalen Schl\xFCssel."}</div></section>`;let e=C.allowed||["same","own"],L=e.includes(H.task_key_choice)?H.task_key_choice:e.includes("same")?"same":"own",i=[["same","Ein Schl\xFCssel f\xFCr alles","Aufgaben, Chats und Coworks nutzen denselben Schl\xFCssel und teilen sich dessen Limits.",e.includes("same")],["own","Eigener Schl\xFCssel f\xFCr Aufgaben","Aufgaben verbrauchen nichts vom Kontingent f\xFCr spontane Chats und Coworks.",e.includes("own")],["shared","Zentraler Aufgaben-Schl\xFCssel",C.has_central?"Vom Admin eingetragen; alle, die ihn w\xE4hlen, teilen sich seine Limits.":"Nicht verf\xFCgbar \u2013 der Admin hat keinen zentralen Aufgaben-Schl\xFCssel eingetragen.",e.includes("shared")]];return t`<section><h2>${d("task",18)} Schlüssel für geplante Aufgaben</h2><div class="form">
      ${C.mode==="own"?t`<div class="hint">${d("lock",14)} Der Admin hat festgelegt, dass geplante Aufgaben nur mit eigenen
        Schlüsseln laufen – ein zentraler oder gemeinsamer Schlüssel ist dafür nicht zugelassen.</div>`:s}
      ${i.map(([M,o,l,a])=>t`<label class="opt ${L===M?"on":""}" style=${a?"":"opacity:.5;cursor:default"}>
        <input type="radio" name="tkc" ?disabled=${!a} .checked=${L===M} @change=${()=>this.set("task_key_choice",M)}>
        <div><b>${o}</b><div class="hint">${l}</div></div></label>`)}
      ${L==="own"?t`<label class="f"><span>Schlüssel für geplante Aufgaben (${A.data.provider.name})</span>
        <input type="password" autocomplete="off" placeholder=${H.has_own_task_key?"\u2022\u2022\u2022 gespeichert \u2013 zum \xC4ndern neu eingeben":"Schl\xFCssel eintragen"}
          @input=${M=>this.set("own_task_key",M.target.value)}></label>`:s}
      <div class="hint">Gilt für alle Läufe geplanter Aufgaben, auch „Jetzt ausführen“. Läufe auf einem eigenen oder zentralen Aufgaben-Schlüssel
        zählen nicht zum persönlichen Tageskontingent.</div></div></section>`}externalSection(){let C=A.data?.external||{};if(!C.has_access&&!C.consent)return s;let H=this.history?.external?.months||[],e=Math.max(.01,...H.map(M=>M.eur)),L=this.history?.external?.names||{},i=H[H.length-1];return t`<section><h2>${d("euro",18)} Kostenpflichtige externe Modelle</h2><div class="card form">
      ${u7()}
      <div class="row" style="flex-wrap:wrap">${C.consent?t`<span class="chip ok">${d("check",13)} Du hast zugestimmt</span>
          <button class="btn ghost" @click=${async()=>{await A.api.ws("external/consent",{accept:!1}),await A.load(),A.notify("Zustimmung zur\xFCckgenommen")}}>Zustimmung zurücknehmen</button>
          <span class="hint">Danach sind externe Modelle für dich gesperrt; Aufgaben weichen nicht mehr aus.</span>`:t`<button class="btn primary" @click=${async()=>{await B2()&&A.notify("Zugestimmt")}}>Lesen und zustimmen …</button>`}</div>
      <div><div class="row"><b class="grow">Diesen Monat</b><span>${G(C.month_eur||0)} von ${G(C.limit_eur||0)}</span></div>
        <div style="height:6px;border-radius:4px;background:var(--lm-hover);overflow:hidden;margin-top:6px"><div style="height:100%;width:${Math.min(100,Math.round(100*(C.month_eur||0)/(C.limit_eur||1)))}%;background:var(--lm-accent)"></div></div>
        ${i&&Object.keys(i.models||{}).length?t`<div class="hint" style="margin-top:6px">${Object.entries(i.models).map(([M,o])=>`${L[M]||M}: ${G(o.eur)} (${o.requests} Anfragen)`).join(" \xB7 ")}</div>`:s}</div>
      ${H.some(M=>M.eur>0)?t`<div><div class="bars" style="height:80px">${H.map(M=>t`<div title="${M.month}: ${G(M.eur)} · ${M.requests} Anfragen" style="height:${Math.max(2,M.eur/e*74)}px"></div>`)}</div>
        <div class="hint">Kosten je Monat, letzte 12 Monate. Das Limit legt der Admin fest; am Monatsersten beginnt es neu.</div></div>`:s}
    </div></section>`}vorgabe(C){let H=A.data.defaults.base?.[C]||{};return H.auto?`Vorgabe \u2013 automatisch (derzeit ${b1(H.model)})`:`Vorgabe (${b1(H.model)})`}render(){let C=A.data,H=this.s,e=Number(H.retention_days??C.retention?.default??0)||0,L=this.history?Object.entries(this.history.days).sort(([c],[u])=>c.localeCompare(u)).slice(-30):[],i=Math.max(1,...L.map(([,c])=>c.prompt+c.completion)),M=Object.entries(H.permissions||{}),o=E(),l=C.view||{},a=l.locked?l.view:H.view||l.view||"simple",m=[["simple","mdi:chat-processing-outline","Einfache Ansicht","Nur deine Nachricht und die Antwort \u2013 wie in einem Messenger. LLMitMir w\xE4hlt die passende KI selbst, antwortet verst\xE4ndlich und erkl\xE4rt Skills, geplante Aufgaben, Zug\xE4nge und Projekte."],["expert","mdi:tune-variant","Expertenansicht","Alles im Blick und selbst steuern: Modellwahl und Auslastung, Cowork mit Schrittliste, Werkzeug-Schritte, Gedanken der Modelle, Verbrauch und alle Einstellungen."]];return t`<div class="page"><h1>${p("Einstellungen")}</h1>
      <section><h2>${d("eye",18)} Ansicht</h2><div class="form">
        ${m.map(([c,u,b,x])=>t`<label class="opt ${a===c?"on":""}" style=${l.locked&&a!==c?"opacity:.5;cursor:default":""}>
          <input type="radio" name="view" ?disabled=${l.locked} .checked=${a===c} @change=${()=>this.set("view",c)}>
          <div class="grow"><b class="row" style="gap:6px">${d(u,18)} ${b}</b><div class="hint">${x}</div></div></label>`)}
        ${l.locked?t`<div class="hint">${d("lock",14)} Die Ansicht hat ${C.user.is_admin?"ein Admin (unter Admin \u2192 Ansicht)":"der Admin"} für dich festgelegt.</div>`:t`<div class="hint">Wirkt nach dem Speichern sofort. Du kannst jederzeit zurückwechseln.</div>`}</div></section>
      ${o?s:t`<section><h2>${d("sparkle",18)} Modelle</h2><div class="two">
        <label class="f"><span>Standard für Chats</span><select @change=${c=>this.set("model_chat",c.target.value||null)}>
          <option value="">${this.vorgabe("chat")}</option>${C.models.filter(c=>!c.external).map(c=>t`<option value=${c.id} ?selected=${H.model_chat===c.id}>${c.name}</option>`)}</select></label>
        <label class="f"><span>Standard für Coworks & Aufgaben</span><select @change=${c=>this.set("model_agent",c.target.value||null)}>
          <option value="">${this.vorgabe("agent")}</option>${C.models.filter(c=>!c.external).map(c=>t`<option value=${c.id} ?selected=${H.model_agent===c.id}>${c.name}</option>`)}</select></label></div>
        <div class="hint" style="margin-top:8px">„Vorgabe“ heißt: LLMitMir nimmt das passendste Modell, das gerade nicht überlastet ist, und berücksichtigt
          neu erschienene Modelle von selbst. Mit einem festen Modell empfiehlt der Chat einen Wechsel, wenn es stark ausgelastet ist.</div></section>`}
      ${C.key_mode==="per_user_own"?t`<section><h2>${d("key",18)} Dein API-Schlüssel</h2>
        <label class="f"><span>Schlüssel für ${C.provider.name}</span><input type="password" autocomplete="off" placeholder=${H.has_own_key?"\u2022\u2022\u2022 gespeichert \u2013 zum \xC4ndern neu eingeben":"Schl\xFCssel eintragen"}
          @input=${c=>this.set("own_key",c.target.value)}></label>
        <div class="hint">Der Schlüssel gilt nur für dich. Limits und Verbrauch beziehen sich auf ihn.</div></section>`:s}
      ${this.taskKeySection()}
      ${this.externalSection()}
      <section><h2>${d("bell",18)} Benachrichtigungen</h2>
        ${this.devicesLoaded?this.devices.length?t`<label class="f"><span>Gerät für Push-Nachrichten (Aufgaben, Werkzeug „Benachrichtigen“)</span>
          <select @change=${c=>{this.deviceSel=c.target.value,this.dirty=!0}}>
            ${this.devices.length>1?t`<option value="" ?selected=${!this.deviceSel}>bitte wählen</option>`:s}
            ${this.devices.map(c=>t`<option value=${c.key} ?selected=${this.deviceSel===c.key}>${c.name}${c.available?"":" (nicht erreichbar)"}</option>`)}</select></label>
          <div class="hint">Zur Auswahl stehen nur die Geräte, die in Home Assistant mit deinem Benutzer verknüpft sind.
            ${C.user.is_admin?t`Welches Gerät zu wem gehört, siehst und änderst du unter <a href="#" @click=${c=>{c.preventDefault(),O("/admin")}}>Admin → Benachrichtigungsgeräte</a>.`:"Fehlt dein Ger\xE4t, frag einen Admin von Home Assistant."}</div>`:t`<div class="hint">Deinem Benutzer ist in Home Assistant noch kein Gerät zugeordnet – deshalb gibt es hier nichts auszuwählen.
            ${C.user.is_admin?t`Unter <a href="#" @click=${c=>{c.preventDefault(),O("/admin")}}>Admin → Benachrichtigungsgeräte</a> kannst du Geräte zuordnen.`:"Ein Admin von Home Assistant kann dein Handy mit deinem Benutzer verkn\xFCpfen."}</div>`:t`<div class="hint">Geräte werden geladen …</div>`}
        ${this.inboxSection()}</section>
      <section><h2>${d("hourglass",18)} Lebensdauer von Chats und Coworks</h2><div class="form">
        <label class="row hint" style="align-items:center"><input type="checkbox" style="width:auto" .checked=${e>0}
          @change=${c=>this.set("retention_days",c.target.checked?C.retention?.suggest||30:0)}>
          Chats und Coworks außerhalb von Projekten automatisch löschen</label>
        ${e>0?t`<label class="f"><span>… nach so vielen Tagen</span>
          <input type="number" min="1" max=${C.retention?.max||3650} .value=${String(e)}
            @change=${c=>this.set("retention_days",Math.max(1,Number(c.target.value)||1))}></label>`:s}
        <div class="hint">${e>0?`Derzeit: ${A5(e)} ab der letzten Benutzung. Danach wird der Chat samt Anh\xE4ngen, Arbeitsbereich und Sandbox restlos gel\xF6scht.`:"Aus \u2013 Chats und Coworks bleiben, bis du sie selbst l\xF6schst."}
          Geprüft wird stündlich. Angeheftete Chats und die Läufe geplanter Aufgaben bleiben. Für Chats in einem Projekt
          gilt die Frist des Projekts.</div></div></section>
      <section><h2>${d("user",18)} ${p("Pers\xF6nliche Hinweise")}</h2>
        <textarea rows="7" placeholder="Was soll LLMitMir immer über dich wissen? Vorlieben, Schreibstil, Zusammenhänge …" .value=${this.memory}
          @input=${c=>{this.memory=c.target.value,this.dirty=!0}}></textarea>
        <div class="hint">Fließt in jeden Chat, jedes Cowork und jede Aufgabe ein.</div></section>
      <section><h2>${d("chat",18)} ${o?"Bedienung":"Darstellung & Bedienung"}</h2><div class="form">
        ${o?s:t`<label class="row"><input type="checkbox" style="width:auto" .checked=${H.show_reasoning!==!1} @change=${c=>this.set("show_reasoning",c.target.checked)}> Gedanken der Modelle anzeigen</label>`}
        <label class="row"><input type="checkbox" style="width:auto" .checked=${H.send_on_enter!==!1} @change=${c=>this.set("send_on_enter",c.target.checked)}> Mit Enter senden (Umschalt+Enter = neue Zeile; auf Touch-Geräten immer Zeilenumbruch)</label>
        <label class="f"><span>Bei einer Freigabe ohne Antwort nach …</span>
          <select @change=${c=>this.set("permission_timeout_min",Number(c.target.value))}>
            ${[[0,"einer Stunde warten und dann ablehnen"],[5,"5 Minuten \u2013 dann ohne die Aktion weitermachen"],[15,"15 Minuten \u2013 dann ohne die Aktion weitermachen"],[60,"einer Stunde \u2013 dann ohne die Aktion weitermachen"]].map(([c,u])=>t`<option value=${c} ?selected=${Number(H.permission_timeout_min||0)===c}>${u}</option>`)}
          </select>
          <span class="hint">Gilt für Chat und Cowork. „Ohne die Aktion weitermachen“ heißt: LLMitMir lässt sie aus, erledigt den Rest und nennt im Ergebnis, was fehlt. In geplanten Aufgaben entscheiden die Freigaben der Aufgabe.</span></label></div></section>
      ${M.length?t`<section><h2>${d("lock",18)} Dauerhafte Freigaben (ohne Projekt)</h2>
        ${M.map(([c,u])=>t`<div class="row" style="padding:4px 0"><span class="grow">${C.tools[c]?.label||c}: ${u==="allow"?"erlaubt":u==="deny"?"verboten":"fragen"}</span>
          <button class="btn ghost" @click=${()=>{let b={...H.permissions};delete b[c],this.set("permissions",b)}}>Zurücksetzen</button></div>`)}</section>`:s}
      ${o?s:t`<section><h2>${d("mdi:console",18)} Werkbank</h2>
        ${G9(!!C.werkbank?.configured,this.guide,()=>this.guide=!this.guide,C.user.is_admin)}
        ${C.user.is_admin?t`<div class="hint" style="margin-top:8px">URL und Token trägst du unter <a href="#" @click=${c=>{c.preventDefault(),O("/admin")}}>Admin → Werkbank</a> ein.</div>`:s}</section>`}
      <section><h2>${d("gauge",18)} ${p("Verbrauch")}</h2>
        <div class="card"><div class="row"><span class="grow">Heute: <b>${C.usage.today.requests}</b> Anfragen · <b>${I(C.usage.today.prompt+C.usage.today.completion)}</b> Tokens</span>
          ${C.usage.quota.requests_day?t`<span class="chip">Kontingent ${C.usage.quota.requests_day} Anfragen/Tag</span>`:s}
          ${C.usage.quota.tokens_day?t`<span class="chip">${I(C.usage.quota.tokens_day)} Tokens/Tag</span>`:s}</div>
        ${C.usage.week?t`<div class="hint">Diese Woche: ${C.usage.week.requests} Anfragen · ${I(C.usage.week.prompt+C.usage.week.completion)} Tokens ·
          diesen Monat: ${C.usage.month.requests} Anfragen · ${I(C.usage.month.prompt+C.usage.month.completion)} Tokens</div>`:s}
          ${C.usage.today.task_requests?t`<div class="hint">davon geplante Aufgaben: ${C.usage.today.task_requests} Anfragen · ${I((C.usage.today.task_prompt||0)+(C.usage.today.task_completion||0))} Tokens</div>`:s}
          ${L.length?t`<div class="bars">${L.map(([c,u])=>t`<div title="${c}: ${u.requests} Anfragen, ${I(u.prompt+u.completion)} Tokens"
            style="height:${Math.max(2,(u.prompt+u.completion)/i*110)}px"></div>`)}</div><div class="hint">Tokens je Tag, letzte ${L.length} Tage</div>`:s}</div>
        ${C.tasks?.length&&!o?t`<div style="margin-top:12px">${n0(C.usage.tasks,this.history?.task_key_days)}</div>`:s}</section>
      ${o?t`<div class="hint">Modelle, Werkbank und der Import aus Claude stehen in der Expertenansicht.</div>`:t`<section><h2>${d("import",18)} Import aus Claude</h2><div class="card form">
        <div><b>1. Skills, Zugänge, geplante Aufgaben, Projekte und Erinnerungen</b>
          <div class="hint">Erzeuge einen Einmal-Link (24 h gültig) und füge den Prompt in Claude ein (am besten Claude Code oder ein Cowork mit Werkzeugen).
            Claude sammelt alles, löst Zugangsdaten aus den Skills heraus und schickt es direkt hierher. Importierte Aufgaben sind zunächst pausiert.</div></div>
        ${this.imp?t`<div class="prompt">${this.imp.prompt}</div><div class="row">
          <button class="btn primary" @click=${()=>A2(this.imp.prompt)}>${d("copy",16)} Prompt kopieren</button>
          <span class="hint">Link gültig bis ${D(this.imp.expires)}</span></div>
          <div class="hint">Wichtig: Claude muss ${location.host} erreichen können. Geht das nicht, liefert Claude eine Datei <code>llmitmir-import.json</code>, die du unten hochlädst.</div>`:t`<div><button class="btn primary" @click=${this.newImport}>${d("plus",16)} Import-Link und Prompt erzeugen</button></div>`}
        <div><b>2. Chatverläufe</b><div class="hint">In claude.ai unter Einstellungen → Datenschutz → „Daten exportieren“. Die ZIP-Datei aus der E-Mail hier hochladen
          (enthält Chats, Projekte und Erinnerungen). Auch die Datei <code>llmitmir-import.json</code> aus Schritt 1 kannst du hier hochladen.</div>
          <div class="hint" style="margin-top:6px">Wähle <b>alle ZIP-Dateien</b> des Exports auf einmal aus (z. B. conversations-000.zip, projects-000.zip,
            frames-000.zip, claude_code_cloud-000.zip) – die Manifest-Datei brauchst du nicht. Mehrfaches Hochladen legt nichts doppelt an.</div>
          <label class="btn" style="margin-top:8px" ?disabled=${!!this.impBusy}>${this.impBusy?t`<lm-spark size="16"></lm-spark>`:d("upload",16)} ZIP- oder JSON-Dateien hochladen
            <input type="file" multiple accept=".zip,.json" hidden @change=${this.uploadImport}></label>
          ${this.impBusy?t`<div class="hint" style="margin-top:6px">${this.impBusy}</div>`:s}</div>
        ${this.impResult?t`<div class="card" style="font-size:13.5px"><b>Übernommen:</b> ${this.impResult.chats} Chats, ${this.impResult.projects} Projekte,
          ${this.impResult.skills} Skills, ${this.impResult.credentials} Zugänge, ${this.impResult.tasks} Aufgaben${this.impResult.skipped?` \xB7 ${this.impResult.skipped} schon vorhanden (\xFCbersprungen)`:""}
          <ul style="margin:8px 0 0;padding-left:1.2em">${this.impResult.files.map(c=>t`<li>${c.name}: ${c.error?t`<span style="color:var(--lm-err)">${c.error}</span>`:c.info||(c.found?.length?c.found.join(", "):"ok")}</li>`)}</ul></div>`:s}
      </div></section>`}
      ${this.dirty?t`<div class="savebar fade-in"><button class="btn" @click=${()=>this.reset()}>${p("Abbrechen")}</button>
        <button class="btn primary" @click=${this.save}>${d("check",16)} ${p("Speichern")}</button></div>`:s}
    </div>`}};a1.styles=[j,U9,Z5,u5],h([k()],a1.prototype,"s",2),h([k()],a1.prototype,"memory",2),h([k()],a1.prototype,"dirty",2),h([k()],a1.prototype,"devices",2),h([k()],a1.prototype,"deviceSel",2),h([k()],a1.prototype,"devicesLoaded",2),h([k()],a1.prototype,"history",2),h([k()],a1.prototype,"imp",2),h([k()],a1.prototype,"impResult",2),h([k()],a1.prototype,"guide",2),h([k()],a1.prototype,"impBusy",2),a1=h([F("lm-settings")],a1);var k1=class extends e1{constructor(){super(...arguments);this.a=null;this.dirty=!1;this.loading=!1;this.wbTest=null;this.guide=!1;this.provBusy=""}connectedCallback(){super.connectedCallback(),this.load()}async load(){try{this.a=await A.api.ws("admin/get"),this.dirty=!1}catch(C){A.notify(C.message)}}set(C,H){this.a={...this.a,[C]:H},this.dirty=!0}async save(){let C=this.a;try{this.a=await A.api.ws("admin/save",{config:{provider:C.provider,key_mode:C.key_mode,shared_key:C.shared_key,user_keys:C.user_keys,task_key_mode:C.task_key_mode,shared_task_key:C.shared_task_key,allowed_users:C.allowed_users,quota_default:C.quota_default,quota_users:C.quota_users,search:C.search,werkbank:C.werkbank,views:C.views,notify_devices:{overrides:C.notify_overrides||{}},models:{enabled:C.models.enabled,defaults:C.models.defaults,context:C.models.context,auto_enable_new:C.models.auto_enable_new!==!1},providers:C.providers.map(H=>({id:H.id,enabled:H.enabled,mode:H.mode,key:H.key,endpoint:H.endpoint,extra_models:H.extra_models})),model_access:C.model_access,billing:C.billing}}),this.dirty=!1,A.notify(p("Gespeichert")),window.dispatchEvent(new CustomEvent("llmitmir-admin-saved")),A.data&&await A.load()}catch(H){A.notify(H.message)}}async refresh(){this.loading=!0;try{this.a=await A.api.ws("admin/models_refresh",this.a.shared_key&&this.a.shared_key!=="\u2022\u2022\u2022"?{key:this.a.shared_key}:{}),A.notify("Modelle geladen")}catch(C){A.notify(C.message)}this.loading=!1}deviceSection(C){let H=this.a.notify_devices||[],e=this.a.notify_overrides||{},L=(M,o)=>{let l={...e};o?l[M]=o:delete l[M],this.set("notify_overrides",l)},i=new Map;for(let M of H){let o=e[M.key]!==void 0?e[M.key]:M.user_id;o&&i.set(o,[...i.get(o)||[],M.name])}return t`<section><h2>${d("bell",18)} Benachrichtigungsgeräte</h2>
      <div class="hint" style="margin-bottom:10px">Welches Gerät zu welcher Person gehört, sagt Home Assistant: Ein Handy gehört der Person,
        die die Home-Assistant-App darauf eingerichtet hat. Jede Person wählt in ihren Einstellungen nur noch unter ihren eigenen Geräten.
        Stimmt eine Zuordnung nicht, korrigierst du sie hier – die Korrektur gilt sofort und überlebt neue Anmeldungen des Geräts.</div>
      ${H.length?t`<div class="tw"><table><tr><th>Gerät</th><th>Person</th><th>Herkunft</th></tr>
        ${H.map(M=>{let o=e[M.key]!==void 0?e[M.key]:M.user_id||"";return t`<tr><td><b>${M.name}</b>${M.available?s:t` <span class="chip">nicht erreichbar</span>`}
              <div class="hint">${M.service||M.entity_id||"kein Dienst"}</div></td>
            <td><select style="width:auto;padding:6px 8px" @change=${l=>L(M.key,l.target.value)}>
              <option value="" ?selected=${!o}>– keine Person –</option>
              ${C.map(l=>t`<option value=${l.id} ?selected=${o===l.id}>${l.name}</option>`)}</select></td>
            <td class="hint">${e[M.key]!==void 0?t`von dir zugeordnet${M.user_id&&M.user_id!==e[M.key]?" (Home Assistant sagt: "+(C.find(l=>l.id===M.user_id)?.name||"andere Person")+")":""}`:M.user_id?"aus Home Assistant":"in Home Assistant keiner Person zugeordnet"}</td></tr>`})}</table></div>`:t`<div class="hint">Keine Geräte gefunden – die Home-Assistant-App muss auf dem Handy eingerichtet sein.</div>`}
      <div class="hint" style="margin-top:10px">${C.map(M=>t`<div>${M.name}: ${i.get(M.id)?.join(", ")||"kein Ger\xE4t"}</div>`)}</div>
      <div class="hint" style="margin-top:6px">Hat eine Person mehrere Geräte, wählt sie selbst; hat sie nur eines, gilt das automatisch.</div></section>`}setProv(C,H){this.set("providers",this.a.providers.map(e=>e.id===C?{...e,...H}:e))}moveProv(C,H){let e=[...this.a.providers],L=C+H;L<0||L>=e.length||([e[C],e[L]]=[e[L],e[C]],this.set("providers",e))}async refreshProv(C){if(!(this.dirty&&(await this.save(),this.dirty))){this.provBusy=C;try{this.a=await A.api.ws("admin/provider_refresh",{provider_id:C}),A.notify("Modelle abgerufen"),A.data&&await A.load()}catch(H){A.notify(H.message)}this.provBusy=""}}providersSection(){let C=this.a,H=C.provider_info||{},e=(L,i,M)=>t`<label class="f"><span>${i}</span><input type="password" autocomplete="off" placeholder=${M} .value=${L.key||""}
      @focus=${o=>{o.target.value==="\u2022\u2022\u2022"&&(o.target.value="")}} @input=${o=>this.setProv(L.id,{key:o.target.value})}></label>`;return t`<section><h2>${d("list",18)} KI-Anbieter und Reihenfolge</h2>
      <div class="hint" style="margin-bottom:10px">Neben dem Hauptanbieter oben kannst du kostenpflichtige Anbieter für Claude hinterlegen. Die <b>Reihenfolge</b> entscheidet über den Notfall:
        Ein Anbieter mit „Nur im Notfall“ wird erst wählbar, wenn <b>alle</b> eingeschalteten Anbieter davor für die Person gerade nicht nutzbar sind (Limit erreicht, Schlüssel abgelehnt,
        Monatslimit verbraucht). „Immer wählbar“ heißt: im Modellmenü jederzeit auswählbar. LLMitMir nimmt externe Modelle nie von selbst – nur auf ausdrücklichen Wunsch
        oder wenn eine geplante Aufgabe im Notfall ausweichen darf. Wer welches Modell bekommt und die Preise legst du unten fest.</div>
      ${C.sdk===!1?t`<div class="card" style="color:var(--lm-err)">${d("alert",16)} Das Python-Paket „anthropic“ fehlt noch – Home Assistant neu starten, damit es installiert wird.</div>`:s}
      <div class="prov">${C.providers.map((L,i)=>{let M=L.id!=="main",o=L.state||{};return t`<div class="card ${M&&!L.enabled?"off":""}">
          <div class="head"><span class="pos">${i+1}</span><b class="grow">${M?H[L.id]?.label:`${C.provider.name||"Hauptanbieter"} (Hauptanbieter)`}</b>
            <button class="iconbtn" title="Nach oben" ?disabled=${i===0} @click=${()=>this.moveProv(i,-1)}>${d("up",18)}</button>
            <button class="iconbtn" title="Nach unten" ?disabled=${i===C.providers.length-1} @click=${()=>this.moveProv(i,1)}>${d("arrowDown",18)}</button>
            ${M?t`<label class="row" style="gap:6px"><input type="checkbox" style="width:auto" .checked=${!!L.enabled} @change=${l=>this.setProv(L.id,{enabled:l.target.checked})}> eingeschaltet</label>`:s}</div>
          ${M?t`
          <div class="two"><label class="f"><span>Verfügbarkeit</span><select @change=${l=>this.setProv(L.id,{mode:l.target.value})}>
              <option value="fallback" ?selected=${L.mode!=="always"}>Nur im Notfall</option><option value="always" ?selected=${L.mode==="always"}>Immer wählbar</option></select></label>
            ${L.id==="foundry"?t`<label class="f"><span>Endpunkt (Ressourcenname oder Claude-Adresse)</span><input placeholder="https://<ressource>.services.ai.azure.com/anthropic" .value=${L.endpoint||""}
              @input=${l=>this.setProv(L.id,{endpoint:l.target.value})}></label>`:e(L,"API-Schl\xFCssel (Anthropic Console)","sk-ant-\u2026")}</div>
          ${L.id==="foundry"?t`<div class="two">${e(L,"API-Schl\xFCssel der Foundry-Ressource","Schl\xFCssel aus \u201ESchl\xFCssel und Endpunkt\u201C")}
            <label class="f"><span>Weitere Deployment-Namen (optional, durch Komma getrennt)</span><input placeholder="z. B. mein-claude-sonnet" .value=${(L.extra_models||[]).join(", ")}
              @input=${l=>this.setProv(L.id,{extra_models:l.target.value.split(",").map(a=>a.trim()).filter(Boolean)})}></label></div>
            <div class="hint">Endpunkt: der Name der Ressource oder die Claude-Adresse <code>https://&lt;ressource&gt;.services.ai.azure.com/anthropic</code> (die Azure-OpenAI-Adresse
              derselben Ressource rechnet LLMitMir um). Foundry hat keine Modellliste: LLMitMir fragt jedes bekannte Claude-Modell (und die Namen oben) kostenlos per Token-Zählung ab und übernimmt die Deployments, die antworten.
              Nur „Hosted on Azure“-Deployments verlassen Azure nicht. Abgerechnet wird über die Azure-Rechnung zu den Anthropic-Listenpreisen.</div>`:t`<div class="hint">Die Modellliste kommt direkt von der Anthropic-API. Abgerechnet wird über die Anthropic Console – dort am besten zusätzlich ein Ausgabenlimit setzen.</div>`}
          <div class="row" style="flex-wrap:wrap">
            <button class="btn" ?disabled=${!L.enabled||this.provBusy===L.id} @click=${()=>this.refreshProv(L.id)}>${this.provBusy===L.id?t`<lm-spark size="16"></lm-spark>`:d("retry",16)} Modelle abrufen${this.dirty?" (speichert vorher)":""}</button>
            <span class="hint">${(L.models||[]).length} Modelle${L.models_at?` \xB7 abgerufen ${D(L.models_at)}`:""}</span>
            ${o.blocked?t`<span class="chip err">${d("alert",13)} gesperrt: ${o.reason} (noch ${Math.ceil(o.blocked_for/60)} min)</span>`:o.last_ok?t`<span class="chip ok">${d("check",13)} zuletzt erfolgreich ${D(o.last_ok)}</span>`:s}
            ${o.last_error&&!o.blocked?t`<span class="hint" style="color:var(--lm-err)">${o.last_error}</span>`:s}</div>`:t`<div class="hint">Vorlage, Basis-URL und Schlüssel stehen oben unter „Anbieter“ und „API-Schlüssel“. Kostenlos für die Personen, immer wählbar; nur seine Modelle wählt LLMitMir automatisch.</div>`}
        </div>`})}</div></section>`}extModelsSection(C){let H=this.a,e=H.billing||{},L=H.ext_models||[];if(!L.length)return s;let i=H.model_access||{},M=(a,m,c)=>{let u=new Set(i[a]||[]);c?u.add(m):u.delete(m),this.set("model_access",{...i,[a]:[...u]})},o=(a,m,c)=>{let u={...e.prices||{}},b={...u[a]||{}};c===""?delete b[m]:b[m]=c.replace(",","."),!b.in&&!b.out?delete u[a]:u[a]=b,this.set("billing",{...e,prices:u})},l=[...L].sort((a,m)=>(a.blended||0)-(m.blended||0));return t`<section><h2>${d("euro",18)} Externe Modelle: Preise und Freigaben</h2>
      <div class="hint" style="margin-bottom:10px">Ein externes Modell bekommt nur, wer hier angehakt ist <b>und</b> unten ein Monatslimit über 0 € hat. Preise in € je Million Tokens;
        leer = Anthropic-Listenpreis umgerechnet mit dem Kurs unten. Ohne Preis wird ein Modell niemandem angeboten (keine Abrechnung möglich). Die Personen sehen die Modelle vom günstigsten zum teuersten.</div>
      <div class="tw"><table class="matrix"><tr><th>Modell</th><th class="num">Lesen €/Mio.</th><th class="num">Schreiben €/Mio.</th>${C.map(a=>t`<th>${a.name}</th>`)}</tr>
        ${l.map(a=>{let m=(e.prices||{})[a.key]||{},c=a.price;return t`<tr><td>${a.name}<div class="hint">${a.provider_name} · ${a.id}${c?"":t` · <span style="color:var(--lm-err)">Preis fehlt</span>`}</div></td>
            <td class="num"><input style="width:84px" inputmode="decimal" placeholder=${c?String(c.in).replace(".",","):"?"} .value=${m.in!=null?String(m.in).replace(".",","):""} @input=${u=>o(a.key,"in",u.target.value)}></td>
            <td class="num"><input style="width:84px" inputmode="decimal" placeholder=${c?String(c.out).replace(".",","):"?"} .value=${m.out!=null?String(m.out).replace(".",","):""} @input=${u=>o(a.key,"out",u.target.value)}></td>
            ${C.map(u=>t`<td><input type="checkbox" .checked=${(i[a.key]||[]).includes(u.id)} @change=${b=>M(a.key,u.id,b.target.checked)}></td>`)}</tr>`})}</table></div>
      <div class="two" style="margin-top:12px">
        <label class="f"><span>Umrechnungskurs USD → EUR (für Listenpreise)</span><input inputmode="decimal" .value=${String(e.usd_eur??.86).replace(".",",")}
          @input=${a=>this.set("billing",{...e,usd_eur:a.target.value.replace(",",".")})}></label>
        <label class="f"><span>Ersatzmodell für Notfälle (einfache Ansicht, Aufgaben)</span><select @change=${a=>this.set("billing",{...e,fallback_model:a.target.value})}>
          <option value="" ?selected=${!e.fallback_model}>Das günstigste freigegebene Modell</option>
          ${l.map(a=>t`<option value=${a.key} ?selected=${e.fallback_model===a.key}>${a.name} (${a.provider_name})</option>`)}</select></label></div>
      <div class="hint" style="margin-top:6px">Cache-Preise (wiederholt gelesener Verlauf) leitet LLMitMir aus dem Lesepreis ab (Listenpreise: genau nach Anthropic). Jede Anfrage wird mit dem Preis
        gebucht, der in dem Moment galt – spätere Preisänderungen ändern die Vergangenheit nicht.</div></section>`}costsSection(C){let H=this.a,e=H.billing||{},L=H.costs||{};if(!(H.providers||[]).some(m=>m.id!=="main"&&m.enabled)&&!Object.values(L).some(m=>m.months?.some(c=>c.eur>0)))return s;let i=e.limits||{},M=C.map(m=>L[m.id]?.months||[]),o=Math.max(.01,...M.flat().map(m=>m.eur)),l=M.reduce((m,c)=>m+(c[c.length-1]?.eur||0),0),a=m=>{let[c,u]=m.split("-");return`${u}/${c.slice(2)}`};return t`<section><h2>${d("gauge",18)} Kosten und Monatslimits (externe Modelle)</h2>
      <div class="hint" style="margin-bottom:10px">Jede Anfrage an ein externes Modell wird dauerhaft mit Tokens und Kosten erfasst. Das Monatslimit gilt je Person in Euro;
        ist es erreicht, sind externe Modelle für sie bis zum Monatsersten gesperrt (ein laufender Schritt wird noch fertig). 0 € = keine externen Modelle.</div>
      <label class="f" style="max-width:320px"><span>Standard-Limit je Person (€/Monat)</span><input inputmode="decimal" .value=${String(e.limit_default??0).replace(".",",")}
        @input=${m=>this.set("billing",{...e,limit_default:m.target.value.replace(",",".")})}></label>
      <div class="tw" style="margin-top:12px"><table><tr><th>Person</th><th class="num">Limit €/Monat</th><th class="num">Dieser Monat</th><th>Letzte 12 Monate</th><th class="num">Gesamt</th></tr>
        ${C.map((m,c)=>{let u=M[c],b=u[u.length-1]||{},x=u.reduce((w,J)=>w+J.eur,0),f=L[m.id]?.limit||0;return t`<tr><td>${m.name}</td>
            <td class="num"><input style="width:90px" inputmode="decimal" placeholder=${String(e.limit_default||0).replace(".",",")} .value=${i[m.id]!=null?String(i[m.id]).replace(".",","):""}
              @input=${w=>{let J={...i};w.target.value===""?delete J[m.id]:J[m.id]=w.target.value.replace(",","."),this.set("billing",{...e,limits:J})}}></td>
            <td class="num">${G(b.eur||0)}${f?t`<div class="hint">${Math.round(100*(b.eur||0)/f)} %</div>`:s}</td>
            <td><div class="mbars">${u.map(w=>t`<div title="${a(w.month)}: ${G(w.eur)} · ${w.requests} Anfragen · ${I(w.input+w.output+w.cache_read+w.cache_write)} Tokens${w.task_eur?` \xB7 davon Aufgaben ${G(w.task_eur)}`:""}"
              style="height:${Math.max(1,w.eur/o*32)}px"></div>`)}</div></td>
            <td class="num">${G(x)}</td></tr>`})}
        <tr><td><b>Alle</b></td><td></td><td class="num"><b>${G(l)}</b></td><td></td><td></td></tr></table></div></section>`}viewSection(C){let H=this.a.views||{default:"choice",users:{}},e=[["choice","Selbst w\xE4hlen (startet einfach)"],["simple","Immer einfache Ansicht"],["expert","Immer Expertenansicht"]],L=M=>this.set("views",{...H,...M}),i=M=>{let o=H.users?.[M.id]||H.default||"choice";return o==="choice"?M.view==="expert"?"Experten (selbst gew\xE4hlt)":M.view==="simple"?"Einfach (selbst gew\xE4hlt)":"Einfach":o==="expert"?"Experten":"Einfach"};return t`<section><h2>${d("eye",18)} Ansicht</h2>
      <div class="hint" style="margin-bottom:10px">Die <b>einfache Ansicht</b> zeigt nur Nachricht und Antwort wie in einem Messenger, wählt Modelle immer automatisch,
        lässt die Modelle verständlich antworten und erklärt Skills, geplante Aufgaben, Zugänge und Projekte. Die <b>Expertenansicht</b> ist die volle Oberfläche.
        Mit „Selbst wählen“ startet jede Person einfach und kann die Expertenansicht in ihren Einstellungen einschalten.</div>
      <label class="f" style="max-width:420px"><span>Für alle</span><select @change=${M=>L({default:M.target.value})}>
        ${e.map(([M,o])=>t`<option value=${M} ?selected=${(H.default||"choice")===M}>${o}</option>`)}</select></label>
      <div class="tw" style="margin-top:12px"><table><tr><th>Person</th><th>Ansicht</th><th>Derzeit</th></tr>
        ${C.map(M=>t`<tr><td>${M.name}${M.is_admin?t` <span class="chip">Admin</span>`:s}</td>
          <td><select style="width:auto;padding:6px 8px" @change=${o=>{let l={...H.users||{}};o.target.value?l[M.id]=o.target.value:delete l[M.id],L({users:l})}}>
            <option value="" ?selected=${!H.users?.[M.id]}>Wie für alle</option>
            ${e.map(([o,l])=>t`<option value=${o} ?selected=${H.users?.[M.id]===o}>${l}</option>`)}</select></td>
          <td class="hint">${i(M)}</td></tr>`)}</table></div></section>`}taskKeySection(){let C=this.a,H=C.task_key_mode||"same",e=C.task_usage||{},L=[["same","Gleicher Schl\xFCssel wie f\xFCr alles andere","Geplante Aufgaben teilen sich die Limits mit Chats und Coworks (bisheriges Verhalten)."],["shared","Zentraler Aufgaben-Schl\xFCssel f\xFCr alle","Alle geplanten Aufgaben aller Personen laufen \xFCber einen eigenen Schl\xFCssel \u2013 spontane Chats und Coworks behalten ihr volles Kontingent."],["user","Jede Person entscheidet selbst","In den Einstellungen: ein Schl\xFCssel f\xFCr alles, ein eigener Aufgaben-Schl\xFCssel oder der zentrale Aufgaben-Schl\xFCssel (wenn du hier einen eintr\xE4gst)."],["own","Jede Person muss einen eigenen Schl\xFCssel verwenden","Kein zentraler Schl\xFCssel f\xFCr Aufgaben: Wer geplante Aufgaben anlegt, tr\xE4gt in den Einstellungen einen eigenen Aufgaben-Schl\xFCssel ein. Wer bereits einen eigenen Schl\xFCssel f\xFCr Chats und Coworks hat, darf denselben f\xFCr alles nutzen \u2013 ein gemeinsamer Schl\xFCssel gilt nie f\xFCr Aufgaben."]];return t`<section><h2>${d("task",18)} Schlüssel für geplante Aufgaben</h2><div class="form">
      ${L.map(([i,M,o])=>t`<label class="opt ${H===i?"on":""}"><input type="radio" name="tkm" .checked=${H===i} @change=${()=>this.set("task_key_mode",i)}>
        <div><b>${M}</b><div class="hint">${o}</div></div></label>`)}
      ${H==="shared"||H==="user"?t`<label class="f"><span>Zentraler Aufgaben-Schlüssel${H==="user"?" (optional)":""}</span>
        <input type="password" autocomplete="off" placeholder="nicht gesetzt" .value=${C.shared_task_key||""}
          @focus=${i=>{i.target.value==="\u2022\u2022\u2022"&&(i.target.value="")}} @input=${i=>this.set("shared_task_key",i.target.value)}></label>
        ${H==="shared"&&!C.shared_task_key?t`<div class="hint">Solange kein Schlüssel eingetragen ist, nutzen Aufgaben den normalen Schlüssel.</div>`:s}`:s}
      ${H==="own"?t`<div class="hint">${d("lock",14)} Beim Speichern wird ein bisher eingetragener zentraler Aufgaben-Schlüssel entfernt.
        Aufgaben, die noch auf ihm laufen, nutzen danach den eigenen Schlüssel der Person – fehlt der, meldet der Lauf das im Ergebnis.</div>
        <div class="tw"><table><tr><th>Person</th><th>Eigener Aufgaben-Schlüssel</th></tr>
          ${C.users.filter(i=>i.is_active).map(i=>t`<tr><td>${i.name}</td>
            <td>${i.has_own_task_key?t`<span class="chip ok">${d("check",13)} eingetragen</span>`:i.has_own_key?t`<span class="chip">nutzt den eigenen Schlüssel für alles</span>`:t`<span class="chip warn">${d("alert",13)} fehlt – keine Läufe</span>`}</td></tr>`)}</table></div>`:s}
      ${e.central?o0({title:"Geplante Aufgaben auf dem zentralen Aufgaben-Schl\xFCssel",label:f7("shared"),accent:!0,todayLabel:"Alle Aufgaben aller Personen heute",today:e.central.today,limits:e.central.limits,days:e.central.days}):s}
      ${e.shared&&(H!=="shared"||!e.central)?o0({title:"Geplante Aufgaben auf dem gemeinsamen Schl\xFCssel",label:"gemeinsamer Schl\xFCssel",todayLabel:"Alle Aufgaben aller Personen heute",today:e.shared.today,limits:e.shared.limits,days:e.shared.days,notes:["Nur L\xE4ufe geplanter Aufgaben; Chats und Coworks auf diesem Schl\xFCssel sind hier nicht mitgez\xE4hlt."]}):s}
    </div></section>`}render(){let C=this.a;if(!C)return t`<div class="page"><lm-spark></lm-spark></div>`;let H=C.users.filter(a=>a.is_active),e=C.models.known||[],L=new Set(C.models.enabled||[]),i=C.models.defaults||{},M=Object.fromEntries((C.models_live||[]).map(a=>[a.id,a])),o=[["shared","Ein gemeinsamer Schl\xFCssel","Alle nutzen denselben Schl\xFCssel \u2013 und teilen sich dessen Limits (bei SAIA 800 Anfragen am Tag)."],["per_user_admin","Admin tr\xE4gt je Person einen Schl\xFCssel ein","Jede Person hat eigene Limits; du verwaltest die Schl\xFCssel zentral hier."],["per_user_own","Jede Person tr\xE4gt ihren eigenen Schl\xFCssel ein","Im Panel unter Einstellungen. Ohne Schl\xFCssel kein Zugriff auf Modelle."]],l=C.key_limits?.shared;return t`<div class="page"><h1>${p("Admin")}</h1>
      <section><h2>${d("cloud",18)} Anbieter</h2><div class="form">
        <div class="two"><label class="f"><span>Vorlage</span><select @change=${a=>{let m=C.presets[a.target.value];this.set("provider",{...C.provider,preset:a.target.value,name:m.name,base_url:m.base_url||C.provider.base_url,transcription_model:m.transcription_model})}}>
            ${Object.entries(C.presets).map(([a,m])=>t`<option value=${a} ?selected=${C.provider.preset===a}>${m.name}</option>`)}</select></label>
          <label class="f"><span>Basis-URL (OpenAI-kompatibel)</span><input .value=${C.provider.base_url} @input=${a=>this.set("provider",{...C.provider,base_url:a.target.value})}></label></div>
        <div class="two"><label class="f"><span>Anzeigename</span><input .value=${C.provider.name||""} @input=${a=>this.set("provider",{...C.provider,name:a.target.value})}></label>
          <label class="f"><span>Modell für Spracheingabe (/audio/transcriptions)</span><input .value=${C.provider.transcription_model||""} @input=${a=>this.set("provider",{...C.provider,transcription_model:a.target.value})}></label></div>
        ${C.presets[C.provider.preset]?.hint?t`<div class="hint">${C.presets[C.provider.preset].hint}</div>`:s}</div></section>
      <section><h2>${d("key",18)} API-Schlüssel</h2><div class="form">
        ${o.map(([a,m,c])=>t`<label class="opt ${C.key_mode===a?"on":""}"><input type="radio" name="km" .checked=${C.key_mode===a} @change=${()=>this.set("key_mode",a)}>
          <div><b>${m}</b><div class="hint">${c}</div></div></label>`)}
        ${C.key_mode==="shared"?t`<label class="f"><span>Gemeinsamer Schlüssel</span><input type="password" autocomplete="off" .value=${C.shared_key}
          @focus=${a=>{a.target.value==="\u2022\u2022\u2022"&&(a.target.value="")}} @input=${a=>this.set("shared_key",a.target.value)}></label>
          ${l?.limit_requests_day?t`<div class="hint">Heute noch ${l.remaining_requests_day} von ${l.limit_requests_day} Anfragen, diese Stunde ${l.remaining_requests_hour} von ${l.limit_requests_hour}.</div>`:s}`:s}
        ${C.key_mode==="per_user_admin"?t`<div class="tw"><table><tr><th>Person</th><th>Schlüssel</th></tr>${H.map(a=>t`<tr><td>${a.name}</td>
          <td><input type="password" autocomplete="off" placeholder="nicht gesetzt" .value=${C.user_keys[a.id]||""}
            @focus=${m=>{m.target.value==="\u2022\u2022\u2022"&&(m.target.value="")}} @input=${m=>this.set("user_keys",{...C.user_keys,[a.id]:m.target.value})}></td></tr>`)}</table></div>`:s}
      </div></section>
      ${this.taskKeySection()}
      ${this.providersSection()}
      ${this.extModelsSection(H)}
      ${this.costsSection(H)}
      <section><h2>${d("user",18)} Wer darf LLMitMir nutzen?</h2>
        <div class="tw"><table><tr><th></th><th>Person</th><th>Anfragen/Tag</th><th>Tokens/Tag</th><th>Heute</th></tr>
          ${H.map(a=>{let m=C.quota_users[a.id]||{},c=C.usage_today[a.id];return t`<tr><td><input type="checkbox" .checked=${C.allowed_users.includes(a.id)} @change=${u=>this.set("allowed_users",u.target.checked?[...C.allowed_users,a.id]:C.allowed_users.filter(b=>b!==a.id))}></td>
              <td>${a.name}${a.is_admin?t` <span class="chip">Admin</span>`:s}</td>
              <td><input type="number" min="0" style="width:100px" placeholder=${String(C.quota_default.requests_day||"\u221E")} .value=${m.requests_day??""}
                @input=${u=>this.set("quota_users",{...C.quota_users,[a.id]:{...m,requests_day:u.target.value===""?null:Number(u.target.value)}})}></td>
              <td><input type="number" min="0" style="width:120px" placeholder=${String(C.quota_default.tokens_day||"\u221E")} .value=${m.tokens_day??""}
                @input=${u=>this.set("quota_users",{...C.quota_users,[a.id]:{...m,tokens_day:u.target.value===""?null:Number(u.target.value)}})}></td>
              <td class="hint">${c?`${c.requests} \xB7 ${I(c.prompt+c.completion)}`:"\u2013"}${c?.task_requests?t`<br>Aufgaben ${c.task_requests} · ${I((c.task_prompt||0)+(c.task_completion||0))}`:s}</td></tr>`})}</table></div>
        <div class="hint" style="margin-top:8px">Ohne Haken sieht die Person den Eintrag in der Seitenleiste, bekommt aber keinen Zugriff (HA kann Seitenleisten-Einträge nicht pro Person ausblenden).
          ${C.allowed_users.length?"":"Solange niemand angehakt ist, haben nur Admins Zugriff."}</div>
        <div class="two" style="margin-top:12px"><label class="f"><span>Standard-Kontingent Anfragen/Tag (0 = unbegrenzt)</span><input type="number" min="0" .value=${String(C.quota_default.requests_day||0)}
            @input=${a=>this.set("quota_default",{...C.quota_default,requests_day:Number(a.target.value)})}></label>
          <label class="f"><span>Standard-Kontingent Tokens/Tag (0 = unbegrenzt)</span><input type="number" min="0" .value=${String(C.quota_default.tokens_day||0)}
            @input=${a=>this.set("quota_default",{...C.quota_default,tokens_day:Number(a.target.value)})}></label></div></section>
      ${this.deviceSection(C.users)}
      ${this.viewSection(H)}
      <section><h2>${d("sparkle",18)} Modelle</h2>
        <div class="row" style="margin-bottom:10px"><button class="btn" @click=${this.refresh} ?disabled=${this.loading}>${this.loading?t`<lm-spark size="16"></lm-spark>`:d("retry",16)} Modellliste laden</button>
          <span class="hint">${e.length} Modelle bekannt</span></div>
        <div class="two">${[["chat","Standard Chat"],["agent","Standard Cowork/Aufgaben"],["vision","Bilder & Scans lesen"]].map(([a,m])=>t`<label class="f"><span>${m}</span>
          <select @change=${c=>this.set("models",{...C.models,defaults:{...i,[a]:c.target.value}})}>
            <option value="" ?selected=${!i[a]||i[a]==="auto"}>Automatisch (derzeit ${M[C.auto_models?.[a]]?.name||C.auto_models?.[a]||"\u2013"})</option>
            ${e.map(c=>t`<option value=${c.id} ?selected=${i[a]===c.id}>${c.name}</option>`)}</select></label>`)}</div>
        <div class="hint" style="margin-top:6px">„Automatisch“ nimmt das am besten geeignete freigegebene Modell, das gerade nicht überlastet ist: Die Liste
          samt Auslastung wird alle drei Minuten neu geladen (zählt bei SAIA nicht zum Limit), neu erschienene Modelle werden anhand ihrer Vorgänger
          eingeschätzt. Hängt ein Modell im Chat, empfiehlt LLMitMir einen Wechsel; geplante Aufgaben mit automatischem Modell wechseln selbst.</div>
        <label class="row" style="margin-top:10px"><input type="checkbox" style="width:auto" .checked=${C.models.auto_enable_new!==!1}
          @change=${a=>this.set("models",{...C.models,auto_enable_new:a.target.checked})}> Neu erscheinende Modelle automatisch freigeben</label>
        <div class="tw" style="margin-top:12px"><table><tr><th>Freigegeben</th><th>Modell</th><th>Auslastung</th><th title="Eignung 0–100 für Chat / Cowork & Aufgaben / Bilder">Eignung</th><th>Fähigkeiten</th><th>Kontext</th></tr>
          ${e.map(a=>{let m=M[a.id]||a,c=P2(m),u=m.quality||{};return t`<tr><td><input type="checkbox" .checked=${L.has(a.id)} @change=${b=>{let x=new Set(L);b.target.checked?x.add(a.id):x.delete(a.id),this.set("models",{...C.models,enabled:[...x]})}}></td>
            <td>${a.name}${m.new?t` <span class="chip accent">neu</span>`:s}<div class="hint">${a.id}${a.gone?" \xB7 nicht mehr angeboten":a.status!=="ready"&&a.status?` \xB7 ${a.status}`:""}</div></td>
            <td class="hint"><span class="row" style="gap:6px;flex-wrap:nowrap">${m5(m)}${c?c.text:"\u2013"}</span></td>
            <td class="hint" style="white-space:nowrap">${u.chat||"\u2013"} / ${u.agent||"\u2013"} / ${u.vision||"\u2013"}</td>
            <td class="hint">${(a.input||[]).join(", ")} → ${(a.output||[]).join(", ")}</td>
            <td><input type="number" style="width:110px" placeholder=${String(C.known_context[a.id]||128e3)} .value=${C.models.context?.[a.id]??""}
              @input=${b=>this.set("models",{...C.models,context:{...C.models.context||{},[a.id]:b.target.value?Number(b.target.value):void 0}})}></td></tr>`})}</table></div></section>
      <section><h2>${d("mdi:console",18)} Werkbank</h2>
        ${G9(!!C.werkbank?.url&&!!C.werkbank?.token,this.guide,()=>this.guide=!this.guide,!0)}
        <div class="two" style="margin-top:12px">
          <label class="f"><span>URL der Werkbank</span><input placeholder="http://192.168.1.50:8787" .value=${C.werkbank?.url||""}
            @input=${a=>this.set("werkbank",{...C.werkbank,url:a.target.value})}></label>
          <label class="f"><span>Token</span><input type="password" autocomplete="off" placeholder="steht nach der Installation auf dem Bildschirm" .value=${C.werkbank?.token||""}
            @focus=${a=>{a.target.value==="\u2022\u2022\u2022"&&(a.target.value="")}} @input=${a=>this.set("werkbank",{...C.werkbank,token:a.target.value})}></label></div>
        <div class="row" style="margin-top:10px;flex-wrap:wrap">
          <button class="btn" @click=${async()=>{this.wbTest={testing:!0};try{this.wbTest=await A.api.ws("admin/werkbank_test",{url:C.werkbank?.url||"",token:C.werkbank?.token||""})}catch(a){this.wbTest={ok:!1,error:a.message}}}}>
            ${this.wbTest?.testing?t`<lm-spark size="16"></lm-spark>`:d("retry",16)} Verbindung testen</button>
          ${this.wbTest&&!this.wbTest.testing?this.wbTest.ok?t`<span class="chip ok">${d("check",13)} verbunden · Version ${this.wbTest.version} · ${this.wbTest.sessions}/${this.wbTest.max_sessions} Sandboxen${this.wbTest.sandbox_image_ready?"":" \xB7 Sandbox-Image fehlt!"}</span>`:t`<span class="chip err">${d("alert",13)} ${this.wbTest.error}</span>`:s}
          ${C.werkbank?.url?t`<button class="btn ghost danger" @click=${()=>this.set("werkbank",{url:"",token:""})}>Werkbank entfernen</button>`:s}</div>
        <div class="hint" style="margin-top:6px">Nach dem Test auf „Speichern“ klicken. Befehle auf der Werkbank fragen wie andere schreibende Aktionen nach einer Freigabe.</div></section>
      <section><h2>${d("search",18)} Websuche</h2><div class="two">
        <label class="f"><span>Anbieter</span><select @change=${a=>this.set("search",{...C.search,provider:a.target.value})}>
          <option value="duckduckgo" ?selected=${C.search.provider!=="searxng"}>DuckDuckGo (ohne Schlüssel)</option>
          <option value="searxng" ?selected=${C.search.provider==="searxng"}>SearXNG (eigene Instanz)</option></select></label>
        ${C.search.provider==="searxng"?t`<label class="f"><span>SearXNG-URL</span><input .value=${C.search.searxng_url||""} @input=${a=>this.set("search",{...C.search,searxng_url:a.target.value})}></label>`:s}</div>
        <div class="hint" style="margin-top:6px">DuckDuckGo funktioniert ohne Schlüssel über die einfache HTML-Seite und kann bei vielen Anfragen kurz sperren.</div></section>
      ${this.dirty?t`<div class="savebar fade-in"><button class="btn" @click=${()=>this.load()}>${p("Abbrechen")}</button>
        <button class="btn primary" @click=${this.save}>${d("check",16)} ${p("Speichern")}</button></div>`:s}
    </div>`}};k1.styles=[j,U9,Z5],h([k()],k1.prototype,"a",2),h([k()],k1.prototype,"dirty",2),h([k()],k1.prototype,"loading",2),h([k()],k1.prototype,"wbTest",2),h([k()],k1.prototype,"guide",2),h([k()],k1.prototype,"provBusy",2),k1=h([F("lm-admin")],k1);var q9="llmitmir.sidebar",X=class extends C1{constructor(){super(...arguments);this.narrow=!1;this.dark=!1;this.access=null;this.drawer=!1;this.collapsed=!1;this.small=!1;this.inited=!1;this._onChange=()=>this.requestUpdate();this._mq=matchMedia("(max-width: 870px)");this._onMq=()=>{this.small=this._mq.matches};this._onLoc=()=>{this.drawer=!1,this.requestUpdate()};this._onAdmin=async()=>{this.access?.allowed||(this.inited=!1,this.access=null,await this.init())};this.openProjects=(()=>{try{return new Set(JSON.parse(localStorage.getItem("llmitmir.openProjects")||"[]"))}catch{return new Set}})();this.drag=null;this.moveSheet=null;this.dragFrom=null;this.dragTimer=null;this.clickTimer=null;this.touchCancel=null;this.suppressClick=!1;this.onDragMove=C=>{let H=this.dragFrom;if(H){if(!this.drag){if(Math.hypot(C.clientX-H.x,C.clientY-H.y)<8)return;this.beginDrag(H.chat,C.clientX,C.clientY)}C.preventDefault(),this.drag={...this.drag,x:C.clientX,y:C.clientY,over:this.dropTargetAt(C.clientX,C.clientY)}}};this.onDragEnd=async()=>{this.detachDrag();let C=this.drag;this.dragFrom=null,C&&(this.drag=null,this.skipClick(),C.over&&await this.moveChat(C.chatId,C.over==="none"?null:C.over))};this.selecting=!1;this.selected=new Set}connectedCallback(){super.connectedCallback(),A.addEventListener("change",this._onChange),window.addEventListener("location-changed",this._onLoc),window.addEventListener("llmitmir-admin-saved",this._onAdmin),this._mq.addEventListener("change",this._onMq),this.small=this._mq.matches;try{this.collapsed=localStorage.getItem(q9)==="1"}catch{}}disconnectedCallback(){super.disconnectedCallback(),A.removeEventListener("change",this._onChange),window.removeEventListener("location-changed",this._onLoc),window.removeEventListener("llmitmir-admin-saved",this._onAdmin),this._mq.removeEventListener("change",this._onMq),this.unsub?.(),this.unsub=void 0,this.inited=!1,this.detachDrag(),this.drag=null,this.dragFrom=null}updated(C){this.selecting&&!this.canSelect&&this.stopSelecting(),C.has("hass")&&this.hass&&(this.dark=!!this.hass.themes?.darkMode,A.data&&(A.data.__dark=this.dark),A.api&&(A.api.hass=this.hass),this.inited||this.init())}async init(){this.inited=!0,$9(this.hass.language),A.api=new z5(this.hass);try{if(this.access=await A.api.ws("access"),!this.access.allowed)return;await A.load(),await this.subscribe(),this.hass.connection.addEventListener("ready",async()=>{await A.load(),await this.subscribe()})}catch(C){A.error=String(C?.message||C),this.requestUpdate()}}async subscribe(){try{await this.unsub?.()}catch{}this.unsub=await A.api.subscribe(C=>A.handle(C))}get path(){return(this.route?.path||"/").split("/").filter(Boolean)}toggleCollapse(){if(this.small){this.drawer=!this.drawer;return}this.collapsed=!this.collapsed;try{localStorage.setItem(q9,this.collapsed?"1":"0")}catch{}}haMenu(){this.dispatchEvent(new CustomEvent("hass-toggle-menu",{bubbles:!0,composed:!0}))}menuBtn(){return this.small||this.collapsed?t`<button class="iconbtn" slot="menu" title="Menü" @click=${()=>this.small?this.drawer=!0:this.toggleCollapse()}>${d(this.small?"menu":"sidebar")}</button>`:s}toggleProject(C){let H=new Set(this.openProjects);H.has(C)?H.delete(C):H.add(C),this.openProjects=H;try{localStorage.setItem("llmitmir.openProjects",JSON.stringify([...H]))}catch{}}dragStart(C,H){if(!(C.button!==0||C.target.closest("lm-menu, button"))){if(this.detachDrag(),C.pointerType==="touch"){let e=C.clientX,L=C.clientY;this.dragTimer=setTimeout(()=>{this.skipClick(),this.moveSheet=H},420);let i=M=>{M.type==="pointermove"&&Math.hypot(M.clientX-e,M.clientY-L)<10||this.detachDrag()};this.touchCancel=i,window.addEventListener("pointermove",i),window.addEventListener("pointerup",i),window.addEventListener("pointercancel",i);return}this.dragFrom={x:C.clientX,y:C.clientY,chat:H},window.addEventListener("pointermove",this.onDragMove),window.addEventListener("pointerup",this.onDragEnd),window.addEventListener("pointercancel",this.onDragEnd)}}skipClick(){this.suppressClick=!0,clearTimeout(this.clickTimer),this.clickTimer=setTimeout(()=>this.suppressClick=!1,800)}detachDrag(){clearTimeout(this.dragTimer),window.removeEventListener("pointermove",this.onDragMove),window.removeEventListener("pointerup",this.onDragEnd),window.removeEventListener("pointercancel",this.onDragEnd),this.touchCancel&&(window.removeEventListener("pointermove",this.touchCancel),window.removeEventListener("pointerup",this.touchCancel),window.removeEventListener("pointercancel",this.touchCancel),this.touchCancel=null)}beginDrag(C,H,e){this.drag={chatId:C.id,title:C.title||p("Neuer Chat"),x:H,y:e,over:null}}dropTargetAt(C,H){return document.elementFromPoint(C,H)?.closest("[data-drop]")?.dataset.drop??null}openChat(C){if(this.suppressClick){this.suppressClick=!1;return}O(`/chat/${C}`)}async moveChat(C,H){let e=(A.data?.chats||[]).find(L=>L.id===C);if(!(!e||(e.project_id||null)===H))try{await A.api.ws("chat/update",{chat_id:C,project_id:H});let L=(A.data?.projects||[]).find(i=>i.id===H)?.name;A.notify(H?p("Nach \u201E{p}\u201C verschoben",{p:L||""}):p("Aus dem Projekt entfernt"))}catch(L){A.notify(String(L?.message||L))}}moveSheetView(){let C=this.moveSheet,H=A.data?.projects||[];return t`<div class="sheet" @click=${e=>e.target===e.currentTarget&&(this.moveSheet=null)}>
      <div class="sheetcard">
        <div class="row"><b class="grow ellipsis">${p("Chat verschieben")}</b>
          <button class="iconbtn" @click=${()=>this.moveSheet=null}>${d("close",18)}</button></div>
        <div class="hint ellipsis" style="margin-bottom:6px">${C?.title||p("Neuer Chat")}</div>
        <button class="mi" @click=${()=>{this.moveSheet=null,this.moveChat(C.id,null)}}>${d("chat",18)} ${p("Ohne Projekt")}</button>
        ${H.map(e=>t`<button class="mi ${C?.project_id===e.id?"sel":""}" @click=${()=>{this.moveSheet=null,this.moveChat(C.id,e.id)}}>
          ${d("project",18)} <span class="grow ellipsis">${e.name}</span>${C?.project_id===e.id?d("check",16):s}</button>`)}
        ${H.length?s:t`<div class="hint" style="padding:8px 10px">${p("Noch keine Projekte angelegt.")}</div>`}
      </div></div>`}get selectableChats(){return(A.data?.chats||[]).filter(C=>C.kind!=="task_run")}get canSelect(){return this.selectableChats.length>X.SELECT_FROM}startSelecting(){this.selecting=!0,this.selected=new Set}stopSelecting(){this.selecting=!1,this.selected=new Set}toggleSelect(C){let H=new Set(this.selected);H.has(C)?H.delete(C):H.add(C),this.selected=H}selectAll(){let C=this.selectableChats.map(H=>H.id);this.selected=this.selected.size===C.length?new Set:new Set(C)}async deleteSelected(){let C=[...this.selected];if(!C.length)return;let H=C.length;if(await v1(H===1?p("Diesen Chat l\xF6schen?"):p("{n} Chats l\xF6schen?",{n:H}))){try{await A.api.ws("chat/delete_many",{chat_ids:C}),this.path[0]==="chat"&&C.includes(this.path[1])&&O("/"),A.notify(H===1?p("Chat gel\xF6scht"):p("{n} Chats gel\xF6scht",{n:H}))}catch(L){A.notify(String(L?.message||L))}this.stopSelecting()}}selectStart(){return this.canSelect?t`<div class="selstart"><button class="btn ghost" @click=${()=>this.startSelecting()}>
      ${d("list",16)} ${p("Chats ausw\xE4hlen")}</button></div>`:s}selectionBar(){let C=this.selectableChats.length,H=this.selected.size;return t`<div class="selbar">
      <button class="iconbtn" title=${p("Abbrechen")} @click=${()=>this.stopSelecting()}>${d("close",18)}</button>
      <span class="grow ellipsis" style="font-size:12.5px">${H?p("{n} ausgew\xE4hlt",{n:H}):p("Chats ausw\xE4hlen")}</span>
      <button class="btn ghost" @click=${()=>this.selectAll()}>${H===C?p("Keine"):p("Alle")}</button>
      <button class="btn danger" ?disabled=${!H} @click=${()=>this.deleteSelected()}>${d("trash",16)} ${p("L\xF6schen")}</button>
    </div>`}selectRow(C){let H=this.selected.has(C.id);return t`<div class="rc sel ${H?"on":""}" @click=${()=>this.toggleSelect(C.id)}>
      <span class="box ${H?"on":""}">${H?d("check",14):s}</span>
      <span class="grow ellipsis">${C.title||p("Neuer Chat")}</span>
      ${C.project_id?t`<span class="muted" title=${p("Projekte")}>${d("project",13)}</span>`:s}
    </div>`}projectTree(){let C=A.data;if(!C?.projects?.length)return s;let H=this.path[0]==="chat"?this.path[1]:"",e=this.path[0]==="project"?this.path[1]:C.chats.find(M=>M.id===H)?.project_id||"",L=M=>C.chats.filter(o=>o.project_id===M&&o.kind!=="task_run"),i=[...C.projects].sort((M,o)=>{let l=L(M.id)[0]?.updated||M.updated||0;return(L(o.id)[0]?.updated||o.updated||0)-l});return t`<div class="rh">${p("Projekte")}</div>
      ${i.map(M=>{let o=this.openProjects.has(M.id)||M.id===e,l=L(M.id);return t`<div class="pj ${M.id===e&&this.path[0]==="project"?"on":""} ${this.drag?.over===M.id?"drop":""}"
            data-drop=${M.id} title=${p("Chat hierher ziehen")}>
            <button class="iconbtn chev" @click=${a=>{a.stopPropagation(),this.toggleProject(M.id)}} title=${o?"Zuklappen":"Aufklappen"}>${d(o?"down":"right",16)}</button>
            <span class="grow ellipsis" @click=${()=>O(`/project/${M.id}`)}>${d("project",16)} ${M.name}</span>
            ${l.some(a=>A.runs[a.id])?t`<lm-spark size="13"></lm-spark>`:s}</div>
          ${o?t`<div class="pjc">${l.slice(0,8).map(a=>this.chatRow(a,H))}
            ${l.length>8?t`<div class="rc more-all" @click=${()=>O(`/project/${M.id}`)}>${p("Alle anzeigen")} (${l.length})</div>`:s}
            ${l.length?s:t`<div class="hint" style="padding:4px 10px 6px 30px">Noch keine Chats</div>`}</div>`:s}`})}`}unread(C){return!C?.updated||C.id===(this.path[0]==="chat"?this.path[1]:"")?!1:(C.updated||0)>(C.last_seen||0)+1}chatRow(C,H){let e=this.unread(C),L=A.data?.projects||[];return t`<div class="rc ${C.id===H?"on":""} ${this.drag?.chatId===C.id?"drag":""}"
        @click=${()=>this.openChat(C.id)} @pointerdown=${i=>this.dragStart(i,C)}>
      ${A.runs[C.id]?t`<lm-spark size="14"></lm-spark>`:C.kind==="cowork"?t`<span class="muted">${d("cowork",15)}</span>`:s}
      <span class="grow ellipsis ${e?"unread":""}">${C.title||p("Neuer Chat")}</span>
      ${e?t`<span class="dot" title=${p("Neu seit deinem letzten Blick")}></span>`:s}
      <lm-menu class="more" direction="down" align="right" @click=${i=>i.stopPropagation()}><button slot="trigger" class="iconbtn">${d("dots",16)}</button>
        <button class="mi" data-close @click=${()=>A.api.ws("chat/update",{chat_id:C.id,pinned:!C.pinned})}>${d(C.pinned?"pinOff":"pin",18)} ${C.pinned?p("L\xF6sen"):p("Anheften")}</button>
        ${L.length?t`<div class="mh">${p("In Projekt verschieben")}</div>
          <button class="mi" data-close @click=${()=>this.moveChat(C.id,null)}>${d("chat",18)} ${p("Ohne Projekt")}</button>
          ${L.map(i=>t`<button class="mi ${C.project_id===i.id?"sel":""}" data-close @click=${()=>this.moveChat(C.id,i.id)}>${d("project",18)} ${i.name}</button>`)}`:s}
        <div class="msep"></div>
        <button class="mi" style="color:var(--lm-err)" data-close @click=${async()=>{await v1(`\u201E${C.title}\u201C l\xF6schen?`)&&(await A.api.ws("chat/delete",{chat_id:C.id}),C.id===H&&O("/"))}}>${d("trash",18)} ${p("L\xF6schen")}</button>
      </lm-menu></div>`}recents(){let C=A.data;if(!C)return s;if(this.selecting){let l=[...this.selectableChats].sort((a,m)=>(m.updated||0)-(a.updated||0));return t`${this.selectionBar()}${l.map(a=>this.selectRow(a))}`}let H=this.path[0]==="chat"?this.path[1]:"",e=C.chats.filter(l=>l.kind!=="task_run"),L=e.filter(l=>l.pinned),i=e.filter(l=>!l.pinned&&!l.project_id).slice(0,40),M=l=>this.chatRow(l,H),o=this.drag?t`<div class="rc dropzone ${this.drag.over==="none"?"drop":""}" data-drop="none">
      ${d("chat",15)}<span class="grow ellipsis">${p("Ohne Projekt")}</span></div>`:s;return t`${L.length?t`<div class="rh">${p("Angeheftet")}</div>${L.map(M)}`:s}
      <div class="rh">${p("Zuletzt")}</div>${o}${i.length?i.map(M):t`<div class="hint" style="padding:4px 10px">${p("Keine Chats")}</div>`}`}sidebar(){let C=A.data,H=this.path[0]||"",e=Object.keys(A.runs).length,L=C?.queue||{},i=(L.running?1:0)+Object.keys(L.position||{}).length,M=(o,l,a,m,c)=>t`<button class="ni ${m?"on":""}" title=${a} @click=${()=>O(o)}>${d(l)}<span class="lbl">${a}</span>${c?t`<span class="badge">${c}</span>`:s}</button>`;return t`<nav class="${this.collapsed&&!this.small?"col":""} ${this.drawer?"open":""}">
      <div class="brand">${this.small?t`<button class="iconbtn" title="Home Assistant" @click=${this.haMenu}>${d("mdi:home-assistant")}</button>`:s}
        <lm-spark size="22" .active=${e>0}></lm-spark><b class="grow">LLMitMir</b>
        <button class="iconbtn" title="Seitenleiste" @click=${this.toggleCollapse}>${d(this.small?"close":"sidebar")}</button></div>
      <div class="nv">
        <button class="ni new" title=${p("Neuer Chat")} @click=${()=>O("/")}><span class="plus">${d("plus",18)}</span><span class="lbl">${p("Neuer Chat")}</span></button>
        ${E()?s:M("/cowork","cowork",p("Neues Cowork"),H==="cowork")}
        ${M("/chats","chat",p("Chats"),H==="chats")}
        ${M("/projects","project",p("Projekte"),H==="projects"||H==="project")}
        ${M("/tasks","task",E()?p("Geplante Aufgaben"):p("Geplant"),H==="tasks"||H==="task",i||null)}
        ${M("/skills","skill",p("Skills"),H==="skills"||H==="skill")}
        ${M("/credentials","key",p("Zug\xE4nge"),H==="credentials"||H==="credential")}
      </div>
      ${this.selecting?s:this.selectStart()}
      <div class="recents">${this.selecting?s:this.projectTree()}${this.recents()}</div>
      <div class="foot"><span class="avatar">${(C?.user?.name||"?").slice(0,1).toUpperCase()}</span>
        <span class="name grow ellipsis" style="font-size:13.5px">${C?.user?.name}</span>
        ${C?.user?.is_admin?t`<button class="iconbtn ${H==="admin"?"on":""}" title=${p("Admin")} @click=${()=>O("/admin")}>${d("admin")}</button>`:s}
        <button class="iconbtn ${H==="settings"?"on":""}" title=${p("Einstellungen")} @click=${()=>O("/settings")}>${d("settings")}</button></div>
    </nav>`}view(){let[C,H]=this.path;switch(C){case"chat":return t`<lm-chat .chatId=${H} .narrow=${this.small}>${this.menuBtn()}</lm-chat>`;case"cowork":return this.wrap(t`<lm-home initialMode=${E()?"chat":"cowork"}></lm-home>`);case"chats":return this.wrap(t`<lm-chats></lm-chats>`);case"projects":return this.wrap(t`<lm-projects></lm-projects>`);case"project":return this.wrap(t`<lm-project .projectId=${H}></lm-project>`);case"tasks":return this.wrap(t`<lm-tasks></lm-tasks>`);case"task":return this.wrap(t`<lm-task .taskId=${H}></lm-task>`);case"skills":return this.wrap(t`<lm-skills></lm-skills>`);case"skill":return this.wrap(t`<lm-skill .skillId=${H}></lm-skill>`);case"credentials":return this.wrap(t`<lm-credentials></lm-credentials>`);case"credential":return this.wrap(t`<lm-credential .credId=${H}></lm-credential>`);case"settings":return this.wrap(t`<lm-settings></lm-settings>`);case"admin":return this.wrap(t`<lm-admin></lm-admin>`);default:return this.wrap(t`<lm-home initialMode="chat"></lm-home>`)}}wrap(C){return t`${this.small||this.collapsed?t`<div class="topbar">${this.menuBtn()}</div>`:s}<div class="view">${C}</div>`}render(){if(!this.access)return t`<div class="deny"><lm-spark size="32"></lm-spark></div>`;if(!this.access.allowed){let C=this.access.is_admin;return t`<div class="deny"><div class="card"><lm-spark size="30" .active=${!1}></lm-spark><h2>${p("Kein Zugriff")}</h2>
        <p class="hint">${C?"Du bist Admin, aber f\xFCr LLMitMir noch nicht freigeschaltet. Lege fest, wer es nutzen darf \u2013 auch dich selbst.":"Bitte die Person, die Home Assistant verwaltet, dich f\xFCr LLMitMir freizuschalten."}</p>
        ${C?t`<lm-admin></lm-admin>`:s}</div></div>`}return A.error&&!A.data?t`<div class="deny"><div class="card">${d("alert")} ${A.error}</div></div>`:A.data?t`<div class="app ${this.small?"small":""}">
      ${this.sidebar()}
      ${this.small&&this.drawer?t`<div class="backdrop" @click=${()=>this.drawer=!1}></div>`:s}
      <main>${this.view()}</main></div>
      ${this.moveSheet?this.moveSheetView():s}
      ${this.drag?t`<div class="dragghost" style="left:${this.drag.x}px;top:${this.drag.y}px">${d("chat",15)}
        <span class="ellipsis">${this.drag.title}</span></div>`:s}
      ${A.toast?t`<div class="toast">${A.toast}</div>`:s}`:t`<div class="deny"><lm-spark size="32"></lm-spark></div>`}};X.styles=[p5,j,$2,B`
    /* Der Bildschirmrand (Statusleiste, Notch, Home-Indikator) gehört dem Panel: Home Assistant
       polstert eigene Panels seit 2026.8 nicht mehr, wenn sie ihn selbst freihalten
       (handle_safe_area). Sonst wäre die Seite höher als der Bildschirm und die oberste Zeile
       würde beim Scrollen halb aus dem Bild rutschen. */
    :host { display: block; box-sizing: border-box; height: 100vh; height: 100dvh; background: var(--lm-bg); position: relative; overflow: hidden;
      padding-top: var(--safe-area-inset-top, env(safe-area-inset-top, 0px));
      padding-bottom: var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px));
      padding-left: var(--safe-area-content-inset-left, var(--safe-area-inset-left, env(safe-area-inset-left, 0px)));
      padding-right: var(--safe-area-content-inset-right, var(--safe-area-inset-right, env(safe-area-inset-right, 0px))); }
    .app { display: flex; height: 100%; }
    nav { width: 272px; flex: none; background: var(--lm-side); border-right: 1px solid var(--lm-line); display: flex; flex-direction: column;
      height: 100%; transition: width .22s ease, transform .25s ease; overflow: hidden; }
    nav.col { width: 60px; }
    .brand { display: flex; align-items: center; gap: 8px; padding: 12px 10px 8px 14px; min-height: 56px; }
    .brand b { font-family: var(--lm-head); font-size: 18px; font-weight: 700; letter-spacing: -.02em; white-space: nowrap; }
    .nv { display: grid; gap: 2px; padding: 4px 8px; }
    .ni { display: flex; align-items: center; gap: 11px; padding: 8px 10px; border-radius: 10px; cursor: pointer; color: var(--lm-text);
      font-size: 14px; border: 0; background: none; width: 100%; text-align: left; white-space: nowrap; min-height: 38px; transition: background .12s; }
    .ni:hover { background: var(--lm-hover); }
    .ni.on { background: color-mix(in srgb, var(--lm-text) 9%, transparent); font-weight: 550; }
    .ni.new { color: var(--lm-accent); font-weight: 560; }
    .ni.new .plus { display: grid; place-items: center; width: 24px; height: 24px; border-radius: 50%; background: var(--lm-accent); color: var(--lm-on-accent); margin: -2px; }
    .ni .badge { margin-left: auto; font-size: 11px; background: var(--lm-accent-soft); color: var(--lm-accent); border-radius: 999px; padding: 1px 7px; }
    .recents { flex: 1; overflow-y: auto; padding: 6px 8px; min-height: 0; }
    .rh { font-size: 11.5px; color: var(--lm-faint); padding: 12px 10px 4px; font-weight: 550; }
    .rc { display: flex; align-items: center; gap: 6px; padding: 6px 4px 6px 10px; border-radius: 9px; cursor: pointer; font-size: 13.5px; color: var(--lm-text); }
    .rc .unread { font-weight: 600; }
    .rc .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--lm-accent); flex: none; margin-right: 2px; }
    .rc:hover { background: var(--lm-hover); }
    .rc.on { background: color-mix(in srgb, var(--lm-text) 9%, transparent); }
    .rc .more { opacity: 0; } .rc:hover .more, .rc.on .more { opacity: 1; }
    .rc .more .iconbtn { width: 28px; height: 28px; }
    .pj { display: flex; align-items: center; gap: 2px; padding: 2px 6px 2px 0; border-radius: 9px; font-size: 13.5px; cursor: pointer; }
    .pj:hover { background: var(--lm-hover); } .pj.on { background: color-mix(in srgb, var(--lm-text) 9%, transparent); }
    .pj .chev { width: 26px; height: 26px; flex: none; } .pj .grow { display: flex; align-items: center; gap: 6px; padding: 5px 0; }
    .pjc { margin-left: 13px; padding-left: 8px; border-left: 1px solid var(--lm-line); }
    .pjc .rc { padding-left: 8px; }
    .more-all { color: var(--lm-muted); font-size: 12.5px; }
    .selstart { padding: 2px 8px 4px; }
    .selstart .btn { width: 100%; justify-content: center; font-size: 12.5px; min-height: 32px; color: var(--lm-muted); }
    .selbar { position: sticky; top: -6px; z-index: 3; display: flex; align-items: center; gap: 4px; margin: -6px -8px 6px;
      padding: 6px 8px; background: var(--lm-side); border-bottom: 1px solid var(--lm-line); }
    .selbar .btn { min-height: 30px; padding: 4px 9px; font-size: 12.5px; }
    .rc.sel { padding-left: 8px; }
    .box { width: 18px; height: 18px; flex: none; border-radius: 5px; border: 1.5px solid var(--lm-line); display: grid;
      place-items: center; color: var(--lm-on-accent); }
    .box.on { background: var(--lm-accent); border-color: var(--lm-accent); }
    .foot { border-top: 1px solid var(--lm-line); padding: 8px; display: flex; align-items: center; gap: 6px; }
    .avatar { width: 32px; height: 32px; border-radius: 50%; background: var(--lm-text); color: var(--lm-bg); display: grid; place-items: center;
      font-weight: 600; font-size: 13px; flex: none; }
    main { flex: 1; min-width: 0; height: 100%; display: flex; flex-direction: column; position: relative; overflow: hidden; }
    .view { overflow-x: hidden; }
    .topbar { display: flex; align-items: center; gap: 4px; padding: 6px 8px; min-height: 52px; }
    .view { flex: 1; min-height: 0; }
    .backdrop { position: absolute; inset: 0; background: rgba(0,0,0,.35); z-index: 15; animation: fadeIn .15s; }
    .small nav { position: absolute; z-index: 16; left: 0; top: 0; bottom: 0; transform: translateX(-100%); width: min(300px, 86vw); box-shadow: 10px 0 40px rgba(0,0,0,.18); }
    .small nav.open { transform: none; }
    .toast { position: absolute; left: 50%; bottom: 22px; transform: translateX(-50%); background: var(--lm-text); color: var(--lm-bg);
      padding: 10px 16px; border-radius: 12px; font-size: 14px; z-index: 50; box-shadow: 0 10px 30px rgba(0,0,0,.25); animation: fadeIn .2s; max-width: 90vw; }
    .deny { display: grid; place-items: center; height: 100%; text-align: center; padding: 24px; }
    .deny .card { max-width: 440px; }
    /* Chats per Ziehen in ein Projekt verschieben */
    .rc { touch-action: pan-y; }
    .rc.drag { opacity: .45; }
    .pj.drop, .rc.drop { background: var(--lm-accent-soft); outline: 1.5px dashed var(--lm-accent); outline-offset: -1.5px; }
    .rc.dropzone { color: var(--lm-muted); border: 1px dashed var(--lm-line); margin: 2px 0 6px; }
    .rc.dropzone.drop { color: var(--lm-accent); border-color: transparent; }
    .sheet { position: absolute; inset: 0; z-index: 40; background: rgba(0,0,0,.35); display: flex; align-items: flex-end;
      justify-content: center; animation: fadeIn .15s; }
    .sheetcard { width: min(420px, 100%); max-height: 70%; overflow-y: auto; background: var(--lm-raise); border: 1px solid var(--lm-line);
      border-radius: 16px 16px 0 0; padding: 12px; display: grid; gap: 2px; box-shadow: 0 -10px 40px rgba(0,0,0,.2); }
    .dragghost { position: fixed; z-index: 60; pointer-events: none; transform: translate(-50%, -150%); max-width: 240px;
      display: flex; align-items: center; gap: 6px; padding: 7px 12px; border-radius: 10px; font-size: 13px;
      background: var(--lm-raise); color: var(--lm-text); border: 1px solid var(--lm-line); box-shadow: var(--lm-shadow); }
    .col .lbl, .col .recents, .col .selstart, .col .foot .name, .col .brand b, .col .badge { display: none; }
    .col .ni { justify-content: center; padding: 8px; }
    .col .foot { flex-direction: column; }
  `],X.SELECT_FROM=10,h([T({attribute:!1})],X.prototype,"hass",2),h([T({type:Boolean})],X.prototype,"narrow",2),h([T({attribute:!1})],X.prototype,"route",2),h([T({attribute:!1})],X.prototype,"panel",2),h([T({type:Boolean,reflect:!0})],X.prototype,"dark",2),h([k()],X.prototype,"access",2),h([k()],X.prototype,"drawer",2),h([k()],X.prototype,"collapsed",2),h([k()],X.prototype,"small",2),h([k()],X.prototype,"openProjects",2),h([k()],X.prototype,"drag",2),h([k()],X.prototype,"moveSheet",2),h([k()],X.prototype,"selecting",2),h([k()],X.prototype,"selected",2),X=h([F("llmitmir-panel")],X);export{X as LLMitMirPanel,D as fmtTime};
/*! Bundled license information:

@lit/reactive-element/css-tag.js:
  (**
   * @license
   * Copyright 2019 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

@lit/reactive-element/reactive-element.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

lit-html/lit-html.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

lit-element/lit-element.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

lit-html/is-server.js:
  (**
   * @license
   * Copyright 2022 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

@lit/reactive-element/decorators/custom-element.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

@lit/reactive-element/decorators/property.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

@lit/reactive-element/decorators/state.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

@lit/reactive-element/decorators/event-options.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

@lit/reactive-element/decorators/base.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

@lit/reactive-element/decorators/query.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

@lit/reactive-element/decorators/query-all.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

@lit/reactive-element/decorators/query-async.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

@lit/reactive-element/decorators/query-assigned-elements.js:
  (**
   * @license
   * Copyright 2021 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

@lit/reactive-element/decorators/query-assigned-nodes.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

lit-html/directive.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

lit-html/directives/unsafe-html.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

dompurify/dist/purify.es.mjs:
  (*! @license DOMPurify 3.4.17 | (c) Cure53 and other contributors | Released under the Apache license 2.0 and Mozilla Public License 2.0 | github.com/cure53/DOMPurify/blob/3.4.17/LICENSE *)
  (*! regenerator-runtime -- Copyright (c) 2014-present, Facebook, Inc. -- license (MIT): https://github.com/babel/babel/blob/main/packages/babel-helpers/LICENSE *)
*/
