# Contributing Guide

Hello. Thanks for considering to contribute to Parkhi. To ensure it goes smooth for both of us, we
have some suggestions we request to follow. If you are stuck, please feel free to reach out anytime
by adding a comment in the respective issue or pull request thread.

## Workflow

We follow a merge request based workflow. To contribute changes, please fork the repository, create
a new branch, add your changes and create a merge request to `main` of our repository.

The commit history must follow the _recipe style_ rather than being a work log. Please read
[Git history: work log vs recipe](https://www.bitsnbites.eu/git-history-work-log-vs-recipe/) to
understand the difference.

Commit messages must follow the following template.

```
component(s): Changes to the component

Optional description explaining the changes.

Signed-off-by: Name <email>
```

In the above template, `component(s)` refers to the fundamental unit(s) whose changes are relevant.

On the opened merge request, please feel free to add information to understand the changes better.

## Coding Style

We follow a strict `camelCase` naming scheme for everything including file names. `PascalCase` must
be used only for classes, interface and enumeration definitions. `SCREAMING_SNAKE_CASE` must be used
for constants.

Since Parkhi is about parsing, we expect the parsers to be as strict as possible. Here strict means
following the documented standard of the file format than using heuristics. This avoids any
surprises. There can be certain exceptions for sake of performance, but that must be used after
careful consideration.

Please try to break the entire parsing flow into independent functions. Then try to test each of
this function through suitable test cases.

We try to test the ideal usage scenario of valid data. Hence, it is okay to not test the corrupt
data cases as the data can be corrupt in an infinite number of ways.

Do not write comments. Instead prefer writing self documenting code. The only instance of commenting
should be when the code logic can not be understood on its own.

We have [`docs`](/docs) for documenting the public API of Parkhi. Please keep it updated whenever
there is a change in the exported API.

Prefer simple and easy to understand code over mysterious efficient algorithm.

## Conclusion

These guidelines are not meant to bring in a form of _red tapism_. So feel free to go ahead with
your contribution as we can always make reasonable changes as required. If you are stuck and think
we could help, you are welcome to convey it and we will do our best to resolve it.
