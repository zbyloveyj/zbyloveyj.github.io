# Base R teaching example; no package installation required.
# Run from any working directory after setting data_file below.
data_file <- "synthetic-demo.csv"
if (!file.exists(data_file)) {
  stop("Run this script from the downloads directory containing synthetic-demo.csv")
}
d <- read.csv(data_file, stringsAsFactors = FALSE)
stopifnot(!anyDuplicated(d$id), all(d$group %in% c(0, 1)))
cat("Synthetic instructional data only.\n")
print(str(d))
print(aggregate(score ~ group, data = d, FUN = mean))
print(aggregate(score ~ batch, data = d, FUN = mean))
model <- lm(score ~ group + age + batch, data = d)
print(summary(model))
print(confint(model))
cat("This non-random synthetic dataset supports no scientific or causal claims.\n")
