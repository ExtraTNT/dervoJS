import { div, sdiv, Card, Typography, P, H1, H2, Code } from '../../src/index.js';

const red = sdiv('color: red;');
export const philosophyPanel = state =>
  div({})([
    Card({title: 'Philosophy'})([
        Typography({ toc: true, tocPosition: 'right', tocSticky: true })([
          H1({})(['What is dervoJS?']),
          P({})([
            `Dervo is the old Gaulish word for tree. DervoJS is a component library with some additional features based on odocosJS.
            dervoJS aims to be as functional as possible (at least I try to). Partial application can be used to template together webpages, while a central message bus and data store can be used to communicate between components.
            The renderign is optimised to avoid rerendering untouched components, furthermore it is possible to add additional cachin to components, if the renderer is unable to cache automatically.
            dervoJS has its own profiler and state debugger.`
          ]),
          H2({})(['Why use dervoJS?']),
          P({})([
            `dervoJS aims to be fast and light weight, while still provide an easy way to build websites, and allow the developer focus on what and not how.
            dervoJS is highly cusomisable and focuses on being as easy to debug as possible, with build in tools to do so.
            Due to the functional aproach, dervoJS is very flexible and easy to work with.`
          ]),
          H2({})(['Why the renderer in a component library?']),
          P({})([
            `The renderer from odocosJS is very minimalistic. It does not optimise the rendering.
            dervoJS started with the base renderer from odocosJS, implemented more and more wrappers to optimise it, till it completely replaced it.
            The wrapping was done for performance reasons and to add better SVG support. The fun part is, that the profiler wasn not the reason to go fully custom.
            The profiler will probably get extended in the near future.`
          ]),
          H2({})(['Why was dervoJS created?']),
          P({})(['I felt very productive, but was delayed in my main project, so I needed a sink to put my productivity into.']),
          H1({})(['How to use dervoJS']),
          P({})(['dervoJS as modules is very flexible and can simply be imported in your app.js, see the source of the demo pages.']),
          H2({})(['dervoJS with ai?']),
          P({})([
          `Due to the functional nature of dervoJS, it should in theory work well with ai. But I do not recommend it, as dervoJS is very easy to use.
          Ai also tends to write horrible, non functional code, that looks more like hacking something together to test a theory and then not cleaning up.
          Not saying parts of this project wheren't hacked together, and also not telling things don't need a clean up...
          Ai was used to document parts of this projects and also to style some parts (I'm no designer), rest was horribly hacked together by me :D`
          ]),
          H2({})(['Templating']),
          P({})([
            `dervoJS makes heavy use for templates wiht partial application and it is encurraged to do so for your projects too.
            a function for a vnode gets called like: `,
            Code({})([`vnode('tag')({props})([content])`]),
            `dervoJS has elements, that apply the first parameter, so you can use `,
            Code({})([`div({props})([content])`]),
            `You may want to apply some styles to components, for that you can use a vsnode, prefixed with s in dervoJS `,
            Code({})([`const myStyledP = sp('color: red;');`]),
            `and later use it: `,
            Code({})([`myStyledP({props})([content])`]),
            red({})([P({})(['inside the red div'])]),
          ]),
        ]),
    ]),
  ]);
