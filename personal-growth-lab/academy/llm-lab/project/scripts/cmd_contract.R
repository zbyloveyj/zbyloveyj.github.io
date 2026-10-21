# Base-R sample reconciliation for the optional curatedMetagenomicData adapter.
# returnSamples stores sample_id in colData row names, not necessarily a column.
# Kept separate so the sample contract can be tested without downloading cohorts.

cmd_sample_ids <- function(value, label) {
  if (is.null(value) || !length(value)) stop(paste(label, "are missing."))
  value <- as.character(value)
  if (anyNA(value) || any(!nzchar(trimws(value)))) stop(paste(label, "contain empty IDs."))
  if (anyDuplicated(value)) stop(paste(label, "contain duplicate IDs."))
  value
}

reconcile_cmd_samples <- function(assay_ids, returned_metadata, requested_metadata) {
  assay_ids <- cmd_sample_ids(assay_ids, "Assay sample IDs")
  if (!is.data.frame(returned_metadata) || !is.data.frame(requested_metadata)) {
    stop("Returned and requested metadata must be data.frames.")
  }
  if (!"study_name" %in% names(returned_metadata) ||
      !all(c("sample_id", "study_name") %in% names(requested_metadata))) {
    stop("Returned metadata needs study_name; requested metadata needs sample_id and study_name.")
  }
  if (length(assay_ids) != nrow(returned_metadata)) {
    stop("Assay columns and returned metadata rows differ in number.")
  }
  returned_ids <- cmd_sample_ids(rownames(returned_metadata), "Returned metadata row names")
  if (!setequal(assay_ids, returned_ids)) {
    stop("Assay sample IDs and returned metadata row names differ.")
  }
  returned <- returned_metadata[match(assay_ids, returned_ids), , drop = FALSE]
  if ("sample_id" %in% names(returned) &&
      !identical(as.character(returned$sample_id), assay_ids)) {
    stop("Returned sample_id column conflicts with assay sample IDs.")
  }
  requested_ids <- cmd_sample_ids(requested_metadata$sample_id, "Requested sample IDs")
  returned_studies <- as.character(returned$study_name)
  requested_studies <- as.character(requested_metadata$study_name)
  if (anyNA(returned_studies) || anyNA(requested_studies) ||
      any(!nzchar(trimws(returned_studies))) || any(!nzchar(trimws(requested_studies)))) {
    stop("Study names must be nonempty for every sample.")
  }
  # Both directions matter: the upstream API can drop requested samples whose
  # assay is unavailable. Do not silently change the predeclared cohort here.
  requested_keys <- paste(requested_studies, requested_ids, sep = "::")
  keys <- paste(returned_studies, assay_ids, sep = "::")
  missing_keys <- setdiff(requested_keys, keys)
  unexpected_keys <- setdiff(keys, requested_keys)
  if (length(missing_keys) || length(unexpected_keys)) {
    stop(paste0("Returned/requested sample keys differ. Missing: ",
                paste(missing_keys, collapse = ", "), "; unexpected: ",
                paste(unexpected_keys, collapse = ", "),
                ". Review availability and revise the selection explicitly."))
  }
  original <- requested_metadata[match(keys, requested_keys), , drop = FALSE]
  returned$sample_id <- assay_ids
  list(sample_ids = assay_ids, keys = keys, returned = returned, original = original)
}
