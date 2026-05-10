#!/bin/bash

# Define replacements
REPLACEMENTS=(
    "ml- ms-"
    "mr- me-"
    "pl- ps-"
    "pr- pe-"
    "left- start-"
    "right- end-"
    "rounded-l- rounded-s-"
    "rounded-r- rounded-e-"
    "border-l- border-s-"
    "border-r- border-e-"
    "text-left text-start"
    "text-right text-end"
)

for r in "${REPLACEMENTS[@]}"; do
    old=$(echo $r | cut -d' ' -f1)
    new=$(echo $r | cut -d' ' -f2)
    
    echo "Replacing $old with $new..."
    
    # Prefix can be space, quote, bracket, OR a minus sign (for negative values)
    # We use -i for in-place edit
    find src -type f \( -name "*.tsx" -o -name "*.ts" -o -name "*.css" \) -print0 | xargs -0 sed -i "s/\([ '\"(\-]\)$old\([0-9a-zA-Z\[]\)/\1$new\2/g"
    
    # Special case for classes without numbers/dashes after them (like border-l)
    find src -type f \( -name "*.tsx" -o -name "*.ts" -o -name "*.css" \) -print0 | xargs -0 sed -i "s/\([ '\"(\-]\)$old\([ '\" \t]\)/\1$new\2/g"
done

echo "Done."

