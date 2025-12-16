function printNames(node) {
  console.log(node.name);

  for (let child of node.children) {
    printNames(child);
  }
}

printNames(family);
