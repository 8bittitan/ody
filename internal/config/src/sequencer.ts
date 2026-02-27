export const createSequencer = (initial = 0) => {
  let curr = initial;

  return {
    next() {
      curr += 1;
      return curr;
    },
  };
};
