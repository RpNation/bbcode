export const fontProcessPlugin = () => {
  return (tree, options) => {
    options.data.fonts.forEach((url) => {
      tree.unshift("<style data-bb='true'>@import url('" + url + "');</style>");
    });
    return tree;
  };
};
