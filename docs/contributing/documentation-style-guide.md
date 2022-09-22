---
credits: https://github.com/fastify/fastify/blob/main/docs/Guides/Style-Guide.md
---

# Documentation Style Guide

Welcome to the *Platformatic Documentation Style Guide*. This guide is here to provide
you with a conventional writing style for users writing developer documentation on
our Open Source framework. Each topic is precise and well explained to help you write
documentation users can easily understand and implement.

## Who is This Guide For?

This guide is for anyone who loves to build with Platformatic or wants to contribute
to our documentation. You do not need to be an expert in writing technical
documentation. This guide is here to help you.

Visit [CONTRIBUTING.md](https://github.com/platformatic/platformatic/blob/main/CONTRIBUTING.md)
file on GitHub to join our Open Source folks.

## Before you Write

You should have a basic understanding of:

* JavaScript
* Node.js
* Git
* GitHub
* Markdown
* HTTP
* NPM

### Consider Your Audience

Before you start writing, think about your audience. In this case, your audience
should already know HTTP, JavaScript, NPM, and Node.js. It is necessary to keep
your readers in mind because they are the ones consuming your content. You want
to give as much useful information as possible. Consider the vital things they
need to know and how they can understand them. Use words and references that
readers can relate to easily. Ask for feedback from the community, it can help
you write better documentation that focuses on the user and what you want to
achieve.

### Get Straight to the Point

Give your readers a clear and precise action to take. Start with what is most
important. This way, you can help them find what they need faster. Mostly,
readers tend to read the first content on a page, and many will not scroll
further.

**Example**

Less like this:
>Colons are very important to register a parametric path. It lets
the framework know there is a new parameter created. You can place the colon
before the parameter name so the parametric path can be created.

More Like this:
>To register a parametric path, put a colon before the parameter
name. Using a colon lets the framework know it is a parametric path and not a
static path.

### Images and Video Should Enhance the Written Documentation


Images and video should only be added if they complement the written
documentation, for example to help the reader form a clearer mental model of a
concept or pattern.

Images can be directly embedded, but videos should be included by linking to an
external site, such as YouTube. You can add links by using
`[Title](https://www.websitename.com)` in the Markdown.




### Avoid Plagiarism

Make sure you avoid copying other people's work. Keep it as original as
possible. You can learn from what they have done and reference where it is from
if you used a particular quote from their work.


## Word Choice

There are a few things you need to use and avoid when writing your documentation
to improve readability for readers and make documentation neat, direct, and
clean.


### When to use the Second Person "you" as the Pronoun

When writing articles or guides, your content should communicate directly to
readers in the second person ("you") addressed form. It is easier to give them
direct instruction on what to do on a particular topic. To see an example, visit
the [Quick Start Guide](../getting-started/quick-start-guide.md).

**Example**

Less like this:
>We can use the following plugins.

More like this:
>You can use the following plugins.

According to [Wikipedia](#), ***You*** is usually a second person pronoun.
Also, used to refer to an indeterminate person, as a more common alternative
to a very formal indefinite pronoun.

To recap, **use "you" when writing articles or guides.**

## When to Avoid the Second Person "you" as the Pronoun

One of the main rules of formal writing such as reference documentation, or API
documentation, is to avoid the second person ("you") or directly addressing the
reader.

**Example**

Less like this:
>You can use the following recommendation as an example.

More like this:
>As an example, the following recommendations should be
referenced.

To view a live example, refer to the [Decorators](../reference/configuration.md)
reference document.

To recap, **avoid "you" in reference documentation or API documentation.**

### Avoid Using Contractions

Contractions are the shortened version of written and spoken forms of a word,
i.e. using "don't" instead of "do not". Avoid contractions to provide a more
formal tone.

### Avoid Using Condescending Terms

Condescending terms are words that include:

* Just
* Easy
* Simply
* Basically
* Obviously

The reader may not find it easy to use Platformatic; avoid
words that make it sound simple, easy, offensive, or insensitive. Not everyone
who reads the documentation has the same level of understanding.

### Starting With a Verb

Mostly start your description with a verb, which makes it simple and precise for
the reader to follow. Prefer using present tense because it is easier to read
and understand than the past or future tense.

**Example**

 Less like this:
 >There is a need for Node.js to be installed before you can be
 able to use Platformatic.

 More like this:
 >Install Node.js to make use of Platformatic.

### Grammatical Moods

Grammatical moods are a great way to express your writing. Avoid sounding too
bossy while making a direct statement. Know when to switch between indicative,
imperative, and subjunctive moods.


**Indicative** - Use when making a factual statement or question.

**Example**
>Since there is no testing framework available, "Platformatic recommends ways
to write tests".

**Imperative** - Use when giving instructions, actions, commands, or when you
write your headings.

**Example**
>Install dependencies before starting development.


**Subjunctive** - Use when making suggestions, hypotheses, or non-factual
statements.

**Example**
>Reading the documentation on our website is recommended to get
comprehensive knowledge of the framework.

### Use **Active** Voice Instead of **Passive**

Using active voice is a more compact and direct way of conveying your
documentation.

**Example**

Passive:
>The node dependencies and packages are installed by npm.

Active:
>npm installs packages and node dependencies.

## Writing Style

### Documentation Titles

When creating a new guide, API, or reference in the `/docs/` directory, use
short titles that best describe the topic of your documentation. Name your files
in kebab-cases and avoid Raw or camelCase. To learn more about kebab-case you
can visit this medium article on [Case
Styles](https://medium.com/better-programming/string-case-styles-camel-pascal-snake-and-kebab-case-981407998841).

**Examples**:

>`hook-and-plugins.md`

>`adding-test-plugins.md`

>`removing-requests.md`

### Hyperlinks

Hyperlinks should have a clear title of what it references. Here is how your
hyperlink should look:

```MD
<!-- More like this -->

// Add clear & brief description
[Fastify Plugins] (https://www.fastify.io/docs/latest/Plugins/)

<!--Less like this -->

// incomplete description
[Fastify] (https://www.fastify.io/docs/latest/Plugins/)

// Adding title in link brackets
[](https://www.fastify.io/docs/latest/Plugins/ "fastify plugin")

// Empty title
[](https://www.fastify.io/docs/latest/Plugins/)

// Adding links localhost URLs instead of using code strings (``)
[http://localhost:3000/](http://localhost:3000/)

```

Include in your documentation as many essential references as possible, but
avoid having numerous links when writing to avoid distractions.