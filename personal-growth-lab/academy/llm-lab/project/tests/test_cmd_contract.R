#!/usr/bin/env Rscript
# No Bioconductor or real data required. Run from the project directory:
# Rscript tests/test_cmd_contract.R
file_arg <- grep("^--file=", commandArgs(trailingOnly = FALSE), value = TRUE)
stopifnot(length(file_arg) == 1L)
test_file <- normalizePath(sub("^--file=", "", file_arg), mustWork = TRUE)
source(file.path(dirname(dirname(test_file)), "scripts", "cmd_contract.R"))

passed <- 0L
check <- function(name, expr) {
  force(expr)
  passed <<- passed + 1L
  cat("PASS", name, "\n")
}
expect_error <- function(expr, pattern) {
  error <- tryCatch({force(expr); NULL}, error = function(e) conditionMessage(e))
  stopifnot(is.character(error), length(error) == 1L, grepl(pattern, error, fixed = TRUE))
}
requested <- data.frame(sample_id = c("S1", "S2"), study_name = c("A", "B"),
                        subject_id = c("P1", "P2"), stringsAsFactors = FALSE)
returned <- data.frame(study_name = c("A", "B"), row.names = c("S1", "S2"),
                       stringsAsFactors = FALSE)
abundance <- matrix(c(.1, .2, .3, .4), ncol = 2,
                    dimnames = list(c("s__one", "s__two"), c("S1", "S2")))

check("sample IDs in row names without sample_id column", {
  aligned <- reconcile_cmd_samples(colnames(abundance), returned, requested)
  stopifnot(identical(aligned$keys, c("A::S1", "B::S2")),
            identical(aligned$original$subject_id, c("P1", "P2")))
})
check("assay order governs both metadata tables without changing values", {
  reversed <- abundance[, c("S2", "S1"), drop = FALSE]
  before <- reversed
  aligned <- reconcile_cmd_samples(colnames(reversed), returned, requested)
  stopifnot(identical(aligned$keys, c("B::S2", "A::S1")),
            identical(aligned$original$subject_id, c("P2", "P1")),
            identical(rownames(aligned$returned), colnames(reversed)),
            identical(reversed, before))
})
check("missing requested assay is rejected", {
  expect_error(reconcile_cmd_samples("S1", returned[1, , drop = FALSE], requested),
               "Returned/requested sample keys differ")
})
check("unexpected sample is rejected", {
  extra <- rbind(returned, data.frame(study_name = "C", row.names = "S3"))
  expect_error(reconcile_cmd_samples(c("S1", "S2", "S3"), extra, requested),
               "Returned/requested sample keys differ")
})
check("duplicate assay IDs are rejected", {
  expect_error(reconcile_cmd_samples(c("S1", "S1"), returned, requested), "duplicate IDs")
})
check("optional matching sample_id column is accepted", {
  with_id <- returned
  with_id$sample_id <- rownames(with_id)
  aligned <- reconcile_cmd_samples(c("S2", "S1"), with_id, requested)
  stopifnot(identical(aligned$returned$sample_id, c("S2", "S1")))
})
check("conflicting sample_id column is rejected", {
  with_id <- returned
  with_id$sample_id <- c("S2", "S1")
  expect_error(reconcile_cmd_samples(c("S1", "S2"), with_id, requested), "conflicts")
})
check("absent and blank assay IDs are rejected", {
  expect_error(reconcile_cmd_samples(NULL, returned, requested), "are missing")
  expect_error(reconcile_cmd_samples(c("S1", ""), returned, requested), "empty IDs")
})
check("metadata row names must match the assay", {
  wrong <- returned
  rownames(wrong) <- c("S1", "S3")
  expect_error(reconcile_cmd_samples(c("S1", "S2"), wrong, requested), "row names differ")
})
check("study identity mismatch is rejected", {
  wrong <- returned
  wrong$study_name[2] <- "C"
  expect_error(reconcile_cmd_samples(c("S1", "S2"), wrong, requested),
               "Returned/requested sample keys differ")
})
check("duplicate requested IDs are rejected", {
  wrong <- requested
  wrong$sample_id[2] <- "S1"
  expect_error(reconcile_cmd_samples(c("S1", "S2"), returned, wrong), "duplicate IDs")
})
check("mismatched row count is rejected", {
  expect_error(reconcile_cmd_samples(c("S1", "S2"), returned[1, , drop = FALSE], requested),
               "differ in number")
})
cat("Sample reconciliation contract:", passed, "checks passed.\n")
